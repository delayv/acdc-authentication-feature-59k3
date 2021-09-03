const {WebcController} = WebCardinal.controllers;

/**
 * https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
 * @param query
 * @returns {*}
 */
const getQueryStringParams = () => {
    const query = window.frameElement.src;
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

export default class HomeController extends WebcController{
    constructor(element, history, ...args) {
        super(element, history, ...args);
        const gs1Data = getQueryStringParams();
        console.log(window, gs1Data);

    }
}