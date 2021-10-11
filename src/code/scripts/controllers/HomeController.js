import interpretGS1scan from "../utils/interpretGS1scan/interpretGS1scan.js";

const {WebcController} = WebCardinal.controllers;
const {constants, PLCameraConfig, nativeBridge, imageTypes} = window.Native.Camera;

class RemoteDetection {
    constructor() {
        this.currentResult = {
            authentic: false,
            meta: {
                score: -1.0
            }
        };
        ////////////
        this.sioEndpoint = "wss://d.2001u1.com";
        this.preshared_jwt_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2NDE0MjQwNTcsImlhdCI6MTYzMzY0ODA1NywiYXVkIjoidXJuOnBsIn0.urejtI30oJC-_MWh0Jrspd6IS0geV5Cuzzjn_0nqPR4'
        this.sioClient = io(this.sioEndpoint, {
            onlyBinaryUpgrades: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            rememberUpgrade: true,
            transports: ['websocket'],
            query: {
                token: this.preshared_jwt_token
            }
        });

        this.sioClient.on("connect", () => {
            // console.log(`connected to the server, id=${this.sioClient.id}`);
        });

        this.sioClient.on("disconnect", () => {
            // console.log('disconnected from the server');
        });


        this.sioClient.on('detResp', detResult => {
            // console.log(`client ${this.sioClient.id} received %o`, detResult);
            this.currentResult = detResult;
        });
    }

    static getInstance() {
      if (!RemoteDetection.instance) {
        RemoteDetection.instance = new RemoteDetection();
      }
      return RemoteDetection.instance;
    }

    customCopyBuffer(buffer)
    {
        var bytes = new Uint8Array(buffer);
        var output = new ArrayBuffer(buffer.byteLength);
        var outputBytes = new Uint8Array(output);
        for (var i = 0; i < bytes.length; i++)
            outputBytes[i] = bytes[i];
        return output;
    }

    authenticate(context) {
      nativeBridge.getRawFrame(context.roi.x, context.roi.y, context.roi.w, context.roi.h).then(raw => {
        // let rndVals = new Uint8Array(Array.from({length: 3*256*256}, () => Math.floor(Math.random() * 256)))
        // let crop = rndVals.buffer;
        // TODO: faster deep-copy implementation
        let crop = this.customCopyBuffer(raw.arrayBuffer);
        const dataToEmit = {
            image: {
                width: raw.width,
                height: raw.height,
                channels: 3,
                buffer: crop
            },
            ts: performance.now(),
            product: {
                product_id: "a"
            }
        }
        // console.log(`sending frame length ${crop.byteLength}, w=${raw.width}, h=${raw.height}`);
        this.sioClient.emit('det', dataToEmit);        
      });
    }

    getCurrentResult() {
        return this.currentResult;
    }

    resetCurrentResult() {
        this.currentResult = { authentic: false, meta: { score: -1.0 }};
    }

}
class AssetsManager {
    constructor() { }
    
    static getInstance() {
        if (!AssetsManager.instance) {
            AssetsManager.instance = new AssetsManager();
        }
        return AssetsManager.instance;
    }
    
    getDetectionContext(gtin) {
        // TODO: call dedicated asset endpoint
        console.log(gtin);
        const cw = 256;
        const ch = 256;
        const ctx = {
            roi: {
                x: Math.round((1080 - cw) / 2),
                y: Math.round((1920 - ch) / 2 - ch),
                w: cw,
                h: ch
            }
        };
        return ctx;
    }
}



class AuthFeatureError {
    code = 0;
    message = undefined;

    constructor(error){
        if (typeof error === 'string'){
            this.code = 1;
            this.message = error;
        } else {
            this.code = error.code;
            this.message = error.message;
        }
    }
}

class AuthFeatureResponse  {
    status = false;
    error = undefined;

    constructor(status, error) {
        this.status = status;
        this.error = error ? new AuthFeatureError(error) : undefined;
    }
}

/**
 * https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
 * @param query
 * @returns {*}
 */
const getQueryStringParams = () => {

    const parseQuery = function(query){
        return query.split("?").slice(1).join('?')
    }

    const query = parseQuery(window.frameElement.src);
    return query
        ? (/^[?#]/.test(query) ? query.slice(1) : query)
            .split('&')
            .reduce((params, param) => {
                    let [key, value] = param.split('=');
                    params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
                    return params;
                }, {}
            )
        : {}
};

const getProductInfo = function(gtin, callback){
    const gtinResolver = require('gtin-resolver');
    const keySSI = gtinResolver.createGTIN_SSI('epi', 'epi', gtin);
    const resolver = require('opendsu').loadApi('resolver');
    resolver.loadDSU(keySSI, (err, dsu) => {
        if (err)
            return callback(err);
        dsu.readFile('product/product.json', (err, product) => {
            if (err)
                return callback(err);
            try{
                product = JSON.parse(product);
            } catch (e) {
                return callback(e);
            }
            callback(undefined, product);
        });
    })
}

const getBatchInfo = function(gtin, batchNumber,  callback){
    const gtinResolver = require('gtin-resolver');
    const keySSI = gtinResolver.createGTIN_SSI('epi', 'epi', gtin, batchNumber);
    const resolver = require('opendsu').loadApi('resolver');
    resolver.loadDSU(keySSI, (err, dsu) => {
        if (err)
            return callback(err);
        dsu.readFile('batch/batch.json', (err, batch) => {
            if (err)
                return callback(err);
            try{
                batch = JSON.parse(batch);
            } catch (e) {
                return callback(e);
            }
            callback(undefined, batch);
        });
    })
}

export default class HomeController extends WebcController{
    uiElements = {};
    detectionContext = {};
    cameraRunning = false;


    constructor(element, history, ...args) {
        super(element, history, ...args);
        this._bindElements();

        const gs1Data = getQueryStringParams();
        this.model.gs1Data = gs1Data;
        this.barcodeScannerController = this.element.querySelector('pdm-barcode-scanner-controller');
        const self = this;

        this.onTagClick('scan', self.verifyPack.bind(self));

        this.onTagClick('auth', () => {
            // this.navigateToPageTag('auth');
            this.authenticatePack();
        })

        this.onTagClick('abort', () => {
            this.abortPackAuthentication("Authentication Aborted");
        })

        getProductInfo(gs1Data.gtin, (err, product) => {
            if (err)
                console.log(`Could not read product info`, err);
            else
                self.model.product = product;
            getBatchInfo(gs1Data.gtin, gs1Data.batchNumber, (err, batch) => {
                if (err)
                    console.log(`Could not read batch data`, err);
                else
                    self.model.batch = batch;
            });
        });
    }

    _bindElements() {
        this.uiElements.streamPreview = this.element.querySelector('#streamPreview');
    }

    authenticatePack() {
        this.nativeCameraConfig = {
            sessionPreset: "hd1920x1080",
            flashConfiguration: "torch",
            continuousFocus: true,
            autoOrientationEnabled: false,
            deviceTypes: ["wideAngleCamera"],
            cameraPosition: "back",
            highResolutionCaptureEnabled: true,
            initOrientation: "portrait"
        };
        nativeBridge.startNativeCameraWithConfig(
            this.nativeCameraConfig,
            undefined,
            25,
            640,
            undefined,
            10,
            () => {
                this.cameraRunning = true;
                this.uiElements.streamPreview.src = `${window.Native.Camera.cameraProps._serverUrl}/mjpeg`;
                this.detectionContext = AssetsManager.getInstance().getDetectionContext(this.model.gs1Data.gtin);
                this.iterativeDetections();
            },
            undefined,
            undefined,
            undefined,
            undefined,
            false);
    }

    iterativeDetections() {
        RemoteDetection.getInstance().authenticate(this.detectionContext);
        let currentResult = RemoteDetection.getInstance().getCurrentResult();
        if (currentResult.authentic) {
            this.cameraRunning = false
            nativeBridge.stopNativeCamera();
            alert(`score: ${currentResult.meta.score}`)
            this.report(true, undefined);
        } else if (this.cameraRunning) {
            console.log(`Should redo detection`);
            setTimeout(() => {
                this.iterativeDetections();
            }, 100); 
        }
    }

    abortPackAuthentication(reason) {
        this.cameraRunning = false;
        nativeBridge.stopNativeCamera();
        this.report(false, reason);
    }

    async verifyPack(){
        const self = this;

        const showError = function(error){
            self.showErrorModal("Authentication Feature", error.message || error);
        }

        await self.scanCode((err, scanData) => {
            if (err)
                return showError(`Could not scan Pack`);
            if (!scanData)
                return console.log(`No data scanned`);
            const isValid = self.verify(scanData);
            self.report(isValid, isValid ? undefined : "Package is not valid");
        });
    }

    async scanCode(callback){
        const self = this;
        await self.barcodeScannerController.present((err, scanData) => err
                ? callback(err)
                : callback(undefined, scanData ? self.parseScanData(scanData.result) : scanData));
    }

    parseScanData(result){
        const interpretedData = interpretGS1scan.interpretScan(result);
        const data = interpretedData.AIbrackets.split(/\(\d{1,2}\)/g);
        result = {
            gtin: data[1],
            expiry: data[2],
            batchNumber: data[3],
            serialNumber: data[4]
        }
        return result;
    }

    verify(scanData){
        const self = this;
        return Object.keys(scanData).every(key => {
            if (key === 'expiry'){
                const dateA = new Date(scanData[key].replace(/(\d{2})(\d{2})(\d{2})/g,'$2/$3/$1')).getTime();
                const dateB = new Date(self.model.gs1Data[key].replaceAll(" - ", "/")).getTime();
                return dateA === dateB;
            }
            return scanData[key] === self.model.gs1Data[key];
        });
    }

    report(status, error){
        const event = new CustomEvent('ssapp-action', {
            bubbles: true,
            cancelable: true,
            detail: new AuthFeatureResponse(status, error)
        });
        this.element.dispatchEvent(event);
    }
}