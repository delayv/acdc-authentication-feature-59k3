const {WebcController} = WebCardinal.controllers;
const {constants, PLCameraConfig, nativeBridge, imageTypes} = window.Native.Camera;

export default class AuthController extends WebcController {
    constructor(element, history, ...args) {
        super(element, history, ...args);
        console.log(`Inside Authcontroller ctor`);
        this.cameraConfig = new PLCameraConfig('hd1920x1080', 'torch', true, false);
        nativeBridge.startNativeCameraWithConfig(
            this.cameraConfig,
            undefined,
            25,
            640,
            undefined,
            10,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false);
    }
    
}