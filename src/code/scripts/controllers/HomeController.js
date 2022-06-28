import interpretGS1scan from "../utils/interpretGS1scan/interpretGS1scan.js";

const {WebcController} = WebCardinal.controllers;
const {constants, PLCameraConfig, nativeBridge, imageTypes} = window.Native.Camera;

class RemoteDetection {
    constructor(sioEndpoint, preshared_jwt_token, onResultReceived) {
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

        this.onResultReceivedCallback = onResultReceived;
        this.sioClient.on('detResp', detResult => {
            // console.log(`client ${this.sioClient.id} received %o`, detResult);
            this.onResultReceivedCallback(detResult);
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
        this.sioClient.emit('det', dataToEmit);        
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

const getProductInfo = async function(gtinFields, callback){
    const gtinResolver = require('gtin-resolver');
    const leafletInfoService = gtinResolver.LeafletInfoService;

    let service = await leafletInfoService.init(gtinFields, gtinFields.domain || "epi");
    service.readProductData(callback);
}

const getBatchInfo = async function(gtinFields,  callback){
    const gtinResolver = require('gtin-resolver');
    const leafletInfoService = gtinResolver.LeafletInfoService;

    let service = await leafletInfoService.init(gtinFields, gtinFields.domain || "epi");
    service.readBatchData(callback);
}

export default class HomeController extends WebcController{
    uiElements = {};
    cameraRunning = false;


    constructor(element, history, ...args) {
        super(element, history, ...args);
        this._bindElements();
        this.createOkOverlayPath();
        this.createFailureOverlayPath();
        this.endpoint = "https://a.2001u1.com/api/v1/detectioncontext";
        this.token = "{token_here}";

        
        this.remoteDetection = undefined;
        this.productClientInfo = undefined;
        this.defaultTimeout = undefined;
        this.errorCodes = {
            ABORTED: {code: 101, message: "Aborted"},
            TIMEOUT: {code: 102, message: "Timeout"},
            NO_PRODUCT_INFO: {code: 103, message: `Could not read product info`},
            NO_BATCH_INFO: {code: 104, message: `Could not read batch data`}
        };
        this.authenticationFeatureFoundMessage = "Feature Found";
        this.roiId = 0;

        const gs1Data = getQueryStringParams();
        this.model.gs1Data = gs1Data;
        const self = this;

        this.onTagClick('auth', () => {
            // this.navigateToPageTag('auth');
            document.getElementById("auth_start").hidden = true;
            document.getElementById("auth_abort").hidden = false;
            this.authenticatePack();
        })

        this.onTagClick('abort', () => {
            this.abortPackAuthentication(this.errorCodes.ABORTED);
        })

        // cannot get deviceInfo at this stage because camera has not started. 
        //   TODO: adapt native wrapper
        //         left as an enhancement for future version. For now we re-get fullDetectionContext after camera has started so we can add deviceInfo in request body 
        getProductInfo(gs1Data, (err, product) => {
            if (err) {
                console.log(`Could not read product info`, err);
                this.report(false, this.errorCodes.NO_PRODUCT_INFO);
                return;
            } else {
                this.model.product = product;
                this.productClientInfo = { 
                    ...gs1Data, 
                    ...{name: product.name}, ...{version: product.version}, ...{description: product.description}, ...{manufName: product.manufName} };
                this.startup();
            }
        });
    }

    createOkOverlayPath() {
        this.uiElements.okOverlay.width = 118;
        this.uiElements.okOverlay.height = 118;
        const ctx = this.uiElements.okOverlay.getContext('2d');
        let path1 = new Path2D('M58.86,0c9.13,0,17.77,2.08,25.49,5.79c-3.16,2.5-6.09,4.9-8.82,7.21c-5.2-1.89-10.81-2.92-16.66-2.92 c-13.47,0-25.67,5.46-34.49,14.29c-8.83,8.83-14.29,21.02-14.29,34.49c0,13.47,5.46,25.66,14.29,34.49 c8.83,8.83,21.02,14.29,34.49,14.29s25.67-5.46,34.49-14.29c8.83-8.83,14.29-21.02,14.29-34.49c0-3.2-0.31-6.34-0.9-9.37 c2.53-3.3,5.12-6.59,7.77-9.85c2.08,6.02,3.21,12.49,3.21,19.22c0,16.25-6.59,30.97-17.24,41.62 c-10.65,10.65-25.37,17.24-41.62,17.24c-16.25,0-30.97-6.59-41.62-17.24C6.59,89.83,0,75.11,0,58.86 c0-16.25,6.59-30.97,17.24-41.62S42.61,0,58.86,0L58.86,0z M31.44,49.19L45.8,49l1.07,0.28c2.9,1.67,5.63,3.58,8.18,5.74 c1.84,1.56,3.6,3.26,5.27,5.1c5.15-8.29,10.64-15.9,16.44-22.9c6.35-7.67,13.09-14.63,20.17-20.98l1.4-0.54H114l-3.16,3.51 C101.13,30,92.32,41.15,84.36,52.65C76.4,64.16,69.28,76.04,62.95,88.27l-1.97,3.8l-1.81-3.87c-3.34-7.17-7.34-13.75-12.11-19.63 c-4.77-5.88-10.32-11.1-16.79-15.54L31.44,49.19L31.44,49.19z');
        ctx.fillStyle = "#01A601";
        ctx.fill(path1);
        this.uiElements.okOverlay.setAttribute("style", "position: absolute; top:50%; left:50%; transform: translate(-50%,-50%); opacity: 0; transition: opacity 1500ms;");
    }

    createFailureOverlayPath() {
        this.uiElements.failureOverlay.width = 118;
        this.uiElements.failureOverlay.height = 118;
        const ctx = this.uiElements.failureOverlay.getContext('2d');
        let path1 = new Path2D('m26.744 32.583 26.394 28.145-25.693 28.612 14.131 0.46714 19.27-20.905 18.102 24.525 9.81-5.2554-21.956-26.277 40.758-43.328-18.802 4.4379-29.78 31.649-20.554-23.007zm32.116-32.583c9.13 0 17.77 2.08 25.49 5.79-3.16 2.5-6.09 4.9-8.82 7.21-5.2-1.89-10.81-2.92-16.66-2.92-13.47 0-25.67 5.46-34.49 14.29-8.83 8.83-14.29 21.02-14.29 34.49s5.46 25.66 14.29 34.49 21.02 14.29 34.49 14.29 25.67-5.46 34.49-14.29c8.83-8.83 14.29-21.02 14.29-34.49 0-3.2-0.31-6.34-0.9-9.37 2.53-3.3 5.12-6.59 7.77-9.85 2.08 6.02 3.21 12.49 3.21 19.22 0 16.25-6.59 30.97-17.24 41.62s-25.37 17.24-41.62 17.24-30.97-6.59-41.62-17.24c-10.66-10.65-17.25-25.37-17.25-41.62s6.59-30.97 17.24-41.62 25.37-17.24 41.62-17.24z');
        ctx.fillStyle = "#FF0000";
        ctx.fill(path1);
        this.uiElements.failureOverlay.setAttribute("style", "position: absolute; top:50%; left:50%; transform: translate(-50%,-50%); opacity: 0; transition: opacity 1500ms;");
    }

    startup() {
        const clientInfo = {product: this.productClientInfo};   
        this.getDetectionContext(clientInfo).then(fullDetectionContext => {
            this.fullDetectionContext = fullDetectionContext
            this.remoteDetection = new RemoteDetection(this.fullDetectionContext.sioEndpoint, this.fullDetectionContext.sioToken, (detResult) => {
                let currentResult = detResult
                if (currentResult.authentic) {
                    this.cameraRunning = false
                    nativeBridge.stopNativeCamera();
                    // const message = this.authenticationFeatureFoundMessage;
                    // alert(message);
                    document.getElementById("auth_abort").hidden = true;
                    this.uiElements.okOverlay.style.opacity = "1.0";
                    setTimeout(() => {
                        this.report(true, undefined);
                    }, 1200);
                } else if (this.cameraRunning) {
                    // console.log(`Should redo detection`);
                    this.roiId = (this.roiId+1)%this.fullDetectionContext.rois.length;
                    this.iterativeDetections();
                }
            });
            const overlayStr = `data:image/png;base64, ${this.fullDetectionContext.overlayBase64}`;
            this.uiElements.overlay.src = overlayStr;
            // start the camera, but without torch to have a nice UX
            var cameraConfigForStartup = {...this.fullDetectionContext.cameraConfiguration};
            cameraConfigForStartup.flashConfiguration = "off";
            this.startCamera(cameraConfigForStartup);
        });
    }
    

    getDetectionContext(clientInfo) {
        return fetch(this.endpoint, { 
            method: 'post', 
            headers: new Headers({
              'Authorization': 'bearer ' + this.token, 
              'Content-Type': 'application/json'
            }), 
            body: JSON.stringify(clientInfo)
        }).then((response) => {
            if (response.status >= 400 && response.status < 600) {
                throw new Error("Bad response from server");
            }
            return response; 
        }).then((response) => {
            return response.json().then((context) => {
                if (context === undefined) {
                    alert('Cannot deserialize response to valid context');
                    document.getElementById("auth_abort").hidden = false;
                }
                return context;
            })
        }).catch((error) => {
            console.log(error);
            alert('Network error contacting api verify connection and retry');
            document.getElementById("auth_abort").hidden = false;
        })
    }

    _bindElements() {
        this.uiElements.streamPreviewCanvas = this.element.querySelector('#streamPreviewCanvas');
        this.uiElements.overlay = this.element.querySelector('#overlay');
        this.uiElements.okOverlay = this.element.querySelector('#ok_overlay');
        this.uiElements.failureOverlay = this.element.querySelector('#failure_overlay');
    }

    startCamera(config) {
        nativeBridge.startNativeCameraWithConfig(
            config,
            this.onFramePreview.bind(this),
            25,
            540,
            undefined,
            10,
            () => {
                this.cameraRunning = true;
                // re-get fullDetectionContext adapted to available deviceInfo (see TODO in constructor)
                nativeBridge.getDeviceInfo().then(di => {
                    this.deviceInfo = di;
                    const clientInfo = {
                        product: this.productClientInfo,
                        deviceInfo: this.deviceInfo 
                    }
                    this.getDetectionContext(clientInfo).then(fullDetectionContext => {
                        if (fullDetectionContext === undefined) {
                            alert("Context is not retrieved");
                            document.getElementById("auth_abort").hidden = false;
                        } else {
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
                            document.getElementById("auth_start").hidden = false;
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

    placeUint8RGBArrayInCanvas(canvasElem, array, w, h) {
        canvasElem.width = w;
        canvasElem.height = h;
        const ctx = canvasElem.getContext('2d');
        const clampedArray = new Uint8ClampedArray(w*h*4);
        let j = 0
        for (let i = 0; i < 3*w*h; i+=3) {
            clampedArray[j] = array[i];
            clampedArray[j+1] = array[i+1];
            clampedArray[j+2] = array[i+2];
            clampedArray[j+3] = 255;
            j += 4;
        }
        const imageData = new ImageData(clampedArray, w, h);
        ctx.putImageData(imageData, 0, 0);
    }

    onFramePreview(rgbImage, elapsedTime) {
        this.placeUint8RGBArrayInCanvas(this.uiElements.streamPreviewCanvas, new Uint8Array(rgbImage.arrayBuffer), rgbImage.width, rgbImage.height);
    }

    authenticatePack() {
        if (this.fullDetectionContext.cameraConfiguration.flashConfiguration !== "off") {
            nativeBridge.setFlashModeNativeCamera(this.fullDetectionContext.cameraConfiguration.flashConfiguration);
        }
        this.iterativeDetections();
        if (this.fullDetectionContext.timeout) {
            setTimeout(() => {
                if (this.cameraRunning) {
                    this.abortPackAuthentication(this.errorCodes.TIMEOUT)
                }
            }, 1000.0*this.fullDetectionContext.timeout);
        }
    }

    iterativeDetections() {
        const roi = this.fullDetectionContext.rois[this.roiId];
        var getFrameFct = undefined;
        if (roi.channels === 1) {
            getFrameFct = nativeBridge.getRawFrameYCbCr;
        } else {
            getFrameFct = nativeBridge.getRawFrame
        }
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
        });
    }

    /**
     * @param  {errorCode} error one of errorCodes defined
     */
    abortPackAuthentication(error) {
        this.cameraRunning = false;
        nativeBridge.stopNativeCamera();
        document.getElementById("auth_abort").hidden = true;
        this.uiElements.failureOverlay.style.opacity = "1.0";
        setTimeout(() => {
            this.report(false, error);
        }, 1200);
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