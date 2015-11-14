'use strict';

var cameraId;
var isCameraBusy = false;
var dir = '/home/pi/blvdia-camera/';

var AWS = require('aws-sdk');
var CP = require('child_process');
var FS = require('fs');
var IO = require('socket.io-client');

var serial = CP.execSync('python ' + dir + 'serial.py').toString();
var cameraIds = ['00000000cbe7b8a5', '000000006c351194', '00000000c7a13f5d', '00000000a756dd26', '00000000cb68f0cf', '000000003b09e838'];
var cameraId = cameraIds.indexOf(serial);

var socket = IO.connect('blvdia.herokuapp.com', {
    port: 80
});

CP.exec('omxplayer ' + dir + 'done.mp3');

function start(clientId) {
    var snapIndex = 0;
    var exec = CP.exec(dir + 'img.sh');

    exec.on('exit', function() {
        CP.exec('omxplayer ' + dir + 'done.mp3');

        var body = FS.createReadStream(dir + 'animation.gif');

        var s3 = new AWS.S3();

        s3.upload({
            Bucket: 'blvdia-gif',
            Key: clientId + '.gif',
            ContentType: 'image/gif',
            Body: body
        }).
        send(function(err, data) {
            socket.emit('complete', {
                clientId: clientId,
                url: data.Location
            });
            CP.exec('rm ' + dir + 'animation.gif');
        });
    });

    exec.stdout.on('data', function(data) {
        if (data.indexOf('snap') > -1) {
            CP.exec('omxplayer ' + dir + 'snap.wav');
            socket.emit('snap', {
                index: snapIndex,
                clientId: clientId
            });
            snapIndex++;
        }
    });
}

function fireStart(clientId) {
    if (!isCameraBusy) {
        start(clientId);
    } else {
        setTimeout(function() {
            fireStart(clientId);
        }, 100);
    }
}

function preview(cameraId) {
    isCameraBusy = true;
    var cmd = CP.exec(dir + 'preview.sh');
    cmd.on('exit', function() {
        var body = FS.createReadStream(dir + 'preview.jpg');
        var s3 = new AWS.S3({
            params: {
                Bucket: 'blvdia-preview',
                Key: 'camera-' + cameraId + '-' + Date.now() + '.jpg',
                ContentType: 'image/jpeg',
                Body: body
            }
        });
        s3.upload().send(function(err, data) {
            socket.emit('preview-complete', {
                cameraId: cameraId,
                url: data.Location
            });
            isCameraBusy = false;
        });
    });
}

var heartbeat = setInterval(function() {
    socket.emit('heartbeat', {
        cameraId: cameraId,
        time: Date.now()
    });
}, 1000);


socket.on('deploy', function() {
    clearInterval(heartbeat);
    CP.execSync('cd ' + dir + ' && git pull');
    CP.exec('sudo reboot');
});

socket.on('reboot', function(msg) {
    clearInterval(heartbeat);
    if (msg.cameraId === cameraId) {
        CP.exec('sudo reboot');
    }
});

socket.on('shutdown', function(msg) {
    clearInterval(heartbeat);
    if (msg.cameraId === cameraId) {
        CP.exec('sudo shutdown -h now');
    }
});

socket.on('shutter', function(msg) {
    if (msg.cameraId === cameraId) {
        CP.exec('omxplayer ' + dir + 'start.mp3');
        fireStart(msg.clientId);
    }
});

socket.on('preview', function(msg) {
    if (msg.cameraId === cameraId) {
        preview(msg.cameraId);
    }
});