'use strict';


module.exports = function (router) {

    router.get('/uncaught', function (req, res) {
        setImmediate(function () {
            throw new Error('uncaught!');
        });
    });

    router.get('/slow', function (req, res) {
        setTimeout(function () {
            res.send('completed');
        }, req.query.timeout || 1000);
    });
};
