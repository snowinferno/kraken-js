/*───────────────────────────────────────────────────────────────────────────*\
 │  Copyright 2016 PayPal                                                      │
 │                                                                             │
 │hh ,'""`.                                                                    │
 │  / _  _ \  Licensed under the Apache License, Version 2.0 (the "License");  │
 │  |(@)(@)|  you may not use this file except in compliance with the License. │
 │  )  __  (  You may obtain a copy of the License at                          │
 │ /,'))((`.\                                                                  │
 │(( ((  )) ))    http://www.apache.org/licenses/LICENSE-2.0                   │
 │ `\ `)(' /'                                                                  │
 │                                                                             │
 │   Unless required by applicable law or agreed to in writing, software       │
 │   distributed under the License is distributed on an "AS IS" BASIS,         │
 │   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  │
 │   See the License for the specific language governing permissions and       │
 │   limitations under the License.                                            │
 \*───────────────────────────────────────────────────────────────────────────*/
'use strict';

const thing = require('core-util-is');

const States = {
    CONNECTED: 0,
    DISCONNECTING: 2
};

function onceThunk() {
  let called = false;
  return function once(emitter, events, callback) {
    function call() {
      if (!called) {
        called = true;
        return callback.apply(this, arguments); // jshint ignore:line
      }
    }
    events.forEach(function (event) {
      emitter.once(event, call);
    });
  };
}

const timestamp = () => new Date().toISOString();

const log = (err, eventName) => {
    const msg = err && err.stack || err || 'unknown';
    console.error(timestamp(), eventName, msg);
};

module.exports = function (config = {}) {
    const template = config.template;
    const timeout = config.timeout || 10 * 1000;
    const uncaughtException = thing.isFunction(config.uncaughtException) && config.uncaughtException;

    let app;
    let server;
    let state = States.CONNECTED;

    const close = () => {
        state = States.DISCONNECTING;
        app.emit('shutdown', server, timeout);
    }

    const handleUncaught = (type) => {
        return (err) => {
            if (uncaughtException) {
                uncaughtException(err);
                return;
            }
            log(err, type);
            close();
        }
    }

    return function shutdown(req, res, next) {
        const headers = config.shutdownHeaders || {};

        function json() {
            res.send({message: 'Server is shutting down.'});
        }

        function html() {
            template ? res.render(template) : json();
        }

        if (state === States.DISCONNECTING) {
            headers.Connection = headers.Connection || 'close';
            res.header(headers);
            res.status(503);
            res.format({
                json: json,
                html: html
            });
            return;
        }

        if (!app) {
            // Lazy-bind - only attempt clean shutdown
            // if we've taken at least one request.
            app = req.app;
            server = req.socket.server;

            onceThunk()(process, ['SIGTERM', 'SIGINT'], close);

            const uncaughtEvents = ['uncaughtException'];
            const onceUncaught = onceThunk();
            for (const evt of uncaughtEvents) {
                onceUncaught(process, [evt], handleUncaught(evt));
            }
        }

        next();
    };
};
