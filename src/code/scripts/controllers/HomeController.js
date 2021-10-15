import interpretGS1scan from "../utils/interpretGS1scan/interpretGS1scan.js";

const {WebcController} = WebCardinal.controllers;
const {constants, PLCameraConfig, nativeBridge, imageTypes} = window.Native.Camera;

class RemoteDetection {
    constructor(sioEndpoint, preshared_jwt_token) {
        this.currentResult = {
            authentic: false,
            meta: {
                score: -1.0
            }
        };
        ////////////
        this.sioEndpoint = sioEndpoint;
        this.preshared_jwt_token = preshared_jwt_token;
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

    authenticate(crop, width, height, channels) {
        const dataToEmit = {
            image: {
                width: width,
                height: height,
                channels: channels,
                buffer: crop
            },
            ts: performance.now(),
            product: {
                product_id: "a"
            }
        }
        // console.log(`sending frame length ${crop.byteLength}, w=${raw.width}, h=${raw.height}`);
        this.sioClient.emit('det', dataToEmit);        
    }

    setSioEndpoint(endpoint) {
        this.sioEndpoint 
    }

    getCurrentResult() {
        return this.currentResult;
    }

    resetCurrentResult() {
        this.currentResult = { authentic: false, meta: { score: -1.0 }};
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

function customCopyBuffer(buffer)
{
    var bytes = new Uint8Array(buffer);
    var output = new ArrayBuffer(buffer.byteLength);
    var outputBytes = new Uint8Array(output);
    for (var i = 0; i < bytes.length; i++)
        outputBytes[i] = bytes[i];
    return output;
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
    cameraRunning = false;


    constructor(element, history, ...args) {
        super(element, history, ...args);
        this._bindElements();
        this.endpoint = "https://a.2001u1.com/api/v1/detectioncontext";
        this.token = "{token_here}";
        this.sioEndpoint = "wss://d.2001u1.com";
        this.sioToken = '{token_here}'
        this.remoteDetection = undefined;
        this.productClientInfo = undefined;
        this.defaultTimeout = undefined;
        this.errorCodes = {
            ABORTED: {error: 101, message: "Aborted"},
            TIMEOUT: {error: 102, message: "Timeout"},
            NO_PRODUCT_INFO: {error: 103, message: `Could not read product info`},
            NO_BATCH_INFO: {error: 104, message: `Could not read batch data`}
        };
        this.authenticationFeatureFoundMessage = "Feature Found";
        

        const gs1Data = getQueryStringParams();
        this.model.gs1Data = gs1Data;
        const self = this;

        this.onTagClick('auth', () => {
            // this.navigateToPageTag('auth');
            this.authenticatePack();
        })

        this.onTagClick('abort', () => {
            this.abortPackAuthentication(this.errorCodes.ABORTED);
        })

        getProductInfo(gs1Data.gtin, (err, product) => {
            if (err) {
                console.log(`Could not read product info`, err);
                this.report(false, this.errorCodes.NO_PRODUCT_INFO);
            }
            else {
                self.model.product = product;
                getBatchInfo(gs1Data.gtin, gs1Data.batchNumber, (err, batch) => {
                    if (err) {
                        console.log(`Could not read batch data`, err);
                        this.report(false, this.errorCodes.NO_BATCH_INFO);
                    }
                    else
                        self.model.batch = batch;
                });
                // cannot get deviceInfo at this stage because camera has not started. 
                //   TODO: adapt native wrapper
                //         left as an enhancement for future version. For now we re-get fullDetectionContext after camera has started so we can add deviceInfo in request body 
                this.productClientInfo = { 
                    ...gs1Data, 
                    ...{name: product.name}, ...{version: product.version}, ...{description: product.description}, ...{manufName: product.manufName} };
                const clientInfo = {product: this.productClientInfo};   
                this.getDetectionContext(clientInfo).then(fullDetectionContext => {
                    this.fullDetectionContext = fullDetectionContext
                    this.remoteDetection = new RemoteDetection(this.fullDetectionContext.sioEndpoint || this.sioEndpoint, this.sioToken);
                    const overlayStr = `data:image/png;base64, ${this.fullDetectionContext.overlayBase64}`;
                    this.uiElements.overlay.src = overlayStr;
                    // start the camera, but without torch to have a nice UX
                    var cameraConfigForStartup = {...this.fullDetectionContext.cameraConfiguration};
                    cameraConfigForStartup.flashConfiguration = "off";
                    this.startCamera(cameraConfigForStartup);
                });
            }
        });
    }

    async getDetectionContext(clientInfo) {
        let response = await fetch(this.endpoint, { 
            method: 'post', 
            headers: new Headers({
              'Authorization': 'bearer ' + this.token, 
              'Content-Type': 'application/json'
            }), 
            body: JSON.stringify(clientInfo)
        });
        let fullDetectionContext = await response.json();
        return fullDetectionContext;
    }

    _bindElements() {
        this.uiElements.streamPreview = this.element.querySelector('#streamPreview');
        this.uiElements.overlay = this.element.querySelector('#overlay');
    }

    startCamera(config) {
        nativeBridge.startNativeCameraWithConfig(
            config,
            undefined,
            25,
            640,
            undefined,
            10,
            () => {
                this.cameraRunning = true;
                this.uiElements.streamPreview.src = `${window.Native.Camera.cameraProps._serverUrl}/mjpeg`;
                // re-get fullDetectionContext adapted to available deviceInfo (see TODO in constructor)
                nativeBridge.getDeviceInfo().then(di => {
                    this.deviceInfo = di;
                    const clientInfo = {
                        product: this.productClientInfo,
                        deviceInfo: this.deviceInfo 
                    }
                    this.getDetectionContext(clientInfo).then(fullDetectionContext => {
                        this.fullDetectionContext = fullDetectionContext
                        if (!this.fullDetectionContext.timeout) {
                            this.fullDetectionContext.timeout = this.default_timeout;
                        }
                        if (this.fullDetectionContext.authenticMessage) {
                            this.authenticationFeatureFoundMessage = this.fullDetectionContext.authenticMessage;
                        }
                        if (this.fullDetectionContext.timeoutMessage) {
                            this.errorCodes.TIMEOUT.message = this.fullDetectionContext.timeoutMessage;
                        }
                        if (this.fullDetectionContext.abortedMessage) {
                            this.errorCodes.ABORTED.message = this.fullDetectionContext.abortedMessage;
                        }
                    });
                })
            },
            undefined,
            undefined,
            undefined,
            undefined,
            false);
    }

    authenticatePack() {
        if (this.fullDetectionContext.cameraConfiguration.flashConfiguration !== "off") {
            nativeBridge.setFlashModeNativeCamera(this.fullDetectionContext.cameraConfiguration.flashConfiguration);
        }
        this.iterativeDetections();
        if (this.fullDetectionContext.timeout) {
            setTimeout(() => {
                this.abortPackAuthentication(this.errorCodes.TIMEOUT)
            }, 1000.0*this.fullDetectionContext.timeout);
        }
    }

    iterativeDetections() {
        for (const roi of this.fullDetectionContext.rois) {
            var getFrameFct = undefined;
            if (roi.channels === 1) {
                getFrameFct = nativeBridge.getRawFrameYCbCr;
            } else {
                getFrameFct = nativeBridge.getRawFrame
            }
            // TODO: switch to gray crop w/r to nbr of channels
            getFrameFct(roi.x, roi.y, roi.w, roi.h).then(raw => {
                var crop = undefined;
                // let rndVals = new Uint8Array(Array.from({length: 3*256*256}, () => Math.floor(Math.random() * 256)))
                // let crop = rndVals.buffer;
                // TODO: faster deep-copy implementation
                if (roi.channels === 1) {
                    crop = customCopyBuffer(raw.yArrayBuffer) // because we got a PLYCbCrImage
                } else {
                    crop = customCopyBuffer(raw.arrayBuffer);
                }
                this.remoteDetection.authenticate(crop, roi.w, roi.h, roi.channels);
                let currentResult = this.remoteDetection.getCurrentResult();
                if (currentResult.authentic) {
                    this.cameraRunning = false
                    nativeBridge.stopNativeCamera();
                    const message = this.authenticationFeatureFoundMessage;
                    alert(message);
                    this.report(true, undefined);
                } else if (this.cameraRunning) {
                    // console.log(`Should redo detection`);
                    setTimeout(() => {
                        this.iterativeDetections();
                    }, 100); 
                }
            });
        }
    }

    /**
     * @param  {errorCode} error one of errorCodes defined
     */
    abortPackAuthentication(error) {
        this.cameraRunning = false;
        nativeBridge.stopNativeCamera();
        this.report(false, error);
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