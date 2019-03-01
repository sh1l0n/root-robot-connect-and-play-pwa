// Copyright © 2019 Root Robotics, Inc. (http://www.codewithroot.com/) All rights reserved.

var blePeripheral = null;
var tx = null;
var rx = null;

// callbacks
var loggerCallback = function(message) {
}
var rxCallback = function(data) {
}

function setLoggerCallback(callback) {
    loggerCallback = callback;
}

function setRxCallback(callback) {
    rxCallback = callback;
}

async function requestDeviceAndConnect(options, serialServiceUUID, rxUUID, txUUID) {

    await navigator.bluetooth
    .requestDevice(options)
    .then(device => {
        loggerCallback('Connecting to GATT Server...');
        blePeripheral = device;
        return device.gatt.connect();
    })
    .then(server => {
        loggerCallback('Getting GAP Service...');
        return server.getPrimaryService(serialServiceUUID);
    })
    .then(service => {
        loggerCallback('Getting GAP Characteristics...');
        return service.getCharacteristics();
    })
    .then(characteristics => {
        for(var i=0; i<characteristics.length; i++) {
            if(characteristics[i].uuid == rxUUID) {
                rx = characteristics[i];
            }
            if(characteristics[i].uuid == txUUID) {
                tx = characteristics[i];
            }
        }
    })
    .catch(error => {
        loggerCallback('Connection failed!' + error);
    });

    if(blePeripheral != null) {
        blePeripheral.addEventListener('gattserverdisconnected', onDisconnected);
    }

    if(rx != null) {
        rx.startNotifications().then(_ => {
            rx.addEventListener('characteristicvaluechanged', handleNotifications);
        });
    }
}

function disconnectDevice() {
    if(blePeripheral != null) {
        if(tx != null) {
            tx.stopNotifications();
        }
        loggerCallback('Disconnected from device');
        blePeripheral.gatt.disconnect();
        tx = null;
        rx = null;
        blePeripheral = null;
    }
}

function onDisconnected() {
    loggerCallback("onDisconnected");
    if(tx != null) {
        tx.stopNotifications();
    }
    tx = null;
    rx = null;
    blePeripheral = null;
}


function handleNotifications(event) {
    let value = event.target.value;
    let data = [];
    // Convert raw data bytes to hex values just for the sake of showing something.
    // In the "real" world, you'd use data.getUint8, data.getUint16 or even
    // TextDecoder to process raw data bytes.
    for (let i = 0; i < value.byteLength; i++) {
        data.push('0x' + ('00' + value.getUint8(i).toString(16)).slice(-2));
    }
    rxCallback(data);
}

function sendCommand(arrayIntData) {
    if(tx != null) {
        var data = new Uint8Array(arrayIntData);
        loggerCallback('Send: ' + data);
        tx.writeValue(data);
    }
}