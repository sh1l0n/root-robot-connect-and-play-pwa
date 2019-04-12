// Copyright © 2019 Root Robotics, Inc. (http://www.codewithroot.com/) All rights reserved.

'use strict';

const CACHE_NAME = "rootcoding-cache-v0";
const FILES = [
"index.html",
"ble.js",
"main.dart.js",
"manifest.json",
"sw.js",
"assets/icons-192.png",
"assets/icons-512.png",
"scratch-blocks/lib/blockly_compressed_horizontal.js",
"scratch-blocks/lib/blocks_compressed_horizontal.js",
"scratch-blocks/lib/blocks_compressed.js",
"scratch-blocks/lib/en.js",
"scratch-blocks/square.js",
"scratch-blocks/lib/media/icons/arrow.svg",
"scratch-blocks/lib/media/icons/root/bumpers/bumperBothEditoriPad_3x.png",
"scratch-blocks/lib/media/icons/root/bumpers/bumperLeftEditoriPad_3x.png",
"scratch-blocks/lib/media/icons/root/bumpers/bumperRightEditoriPad_3x.png",
"scratch-blocks/lib/media/icons/control_forever.svg",
"scratch-blocks/lib/media/icons/control_repeat.svg",
"scratch-blocks/lib/media/icons/control_stop.svg",
"scratch-blocks/lib/media/icons/control_wait.svg",
"scratch-blocks/lib/media/icons/event_broadcast_blue.svg",
"scratch-blocks/lib/media/icons/event_when-broadcast-received_blue.svg",
"scratch-blocks/lib/media/icons/event_whenflagclicked.svg",
"scratch-blocks/lib/media/dropdown-arrow.svg",
"scratch-blocks/lib/media/rotate-right.svg",
"scratch-blocks/lib/media/sprites.png",
"scratch-blocks/lib/media/zoom-in.svg",
"scratch-blocks/lib/media/zoom-out.svg",
"scratch-blocks/lib/media/zoom-reset.svg"
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(function(cache) {
            return cache.addAll(FILES);
        })
        .then(() => {
            return self.skipWaiting(); // Prevents the waiting, meaning the service worker activates as soon as it's finished installing.
        })
    );
});

// ##TODO: Deploy https://github.com/bobbylej/simple-sw-generator/blob/master/sw-template.js
self.addEventListener('fetch', event => {
    if(event.request.method == 'GET') {

        // Get the resource local path
        var requestedURL = event.request.url;
        if(event.request.url.indexOf(self.location.origin) != -1) {
            const splittedURL = event.request.url.split(`${self.location.origin}/`);
            if(splittedURL.length==2) {
                requestedURL = splittedURL[1];
            }
        }
  
        // Search the resource on cache
        if(FILES.indexOf(requestedURL) != -1) {
            event.respondWith(
            caches.open(CACHE_NAME)
                .then(cache => cache.match(requestedURL)
                    .then(response => {
                        if (response != null) {
                            return response;
                        }
                        throw Error('Not found', requestedURL);
                    }))
                .catch(error => {
                    return fetch(event.request);
                })
            );
        }
    }
});