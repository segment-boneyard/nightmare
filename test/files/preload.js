(function() {
    window.preloadNumber = 7; 

    window.prompt = function(message, defaultResponse) {
        var response = defaultResponse;
        if(message == 'foo'){
            response =  'bar';
        }
        __nightmare.ipc.send('page-prompt', message, response);
        return response;
    };

    window.confirm = function(message) {
        var response = false;
        if(message == 'foo'){
            response = true;
        }
        __nightmare.ipc.send('page-confirm', message, response);
        return response;
    };
})();
