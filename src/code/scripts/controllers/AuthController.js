const {WebcController} = WebCardinal.controllers;

export default class AuthController extends WebcController {
    constructor(element, history, ...args) {
        super(element, history, ...args);
        console.log(`Inside Authcontroller ctor`);
    }
}