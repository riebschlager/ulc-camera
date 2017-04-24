'use strict';

const dir = '/home/pi/ulc-camera/';

const AWS = require('aws-sdk');
const CP = require('child_process');
const FS = require('fs');
const IO = require('socket.io-client');
AWS.config.region = 'us-west-2';

let socket = IO.connect('ulc-relay.herokuapp.com', { port: 80 });

function takePhoto(boardId) {
    let cmd = CP.exec('/usr/bin/fswebcam --no-banner -r 1920x1080 --jpeg 90 /home/pi/ulc-camera/board-image.jpg -S 30');
    cmd.on('exit', () => {
        let body = FS.createReadStream(dir + 'board-image.jpg');
        let s3 = new AWS.S3({
            params: {
                Bucket: 'ulc.the816.co',
                Key: boardId + '-' + Date.now() + '.jpg',
                ContentType: 'image/jpeg',
                Body: body
            }
        });
        s3.upload().send(function(err, data) {
            socket.emit('take-photo-complete', {
                url: data.Location,
                boardId: boardId
            });
        });
    });
}

let heartbeat = setInterval(function() {
    socket.emit('heartbeat', { time: Date.now() });
}, 1000);

socket.on('deploy', function() {
    clearInterval(heartbeat);
    CP.execSync('cd ' + dir + ' && git pull');
    CP.exec('sudo reboot');
});

socket.on('reboot', function() {
    clearInterval(heartbeat);
    CP.exec('sudo reboot');
});

socket.on('shutdown', function() {
    clearInterval(heartbeat);
    CP.exec('sudo shutdown -h now');
});

socket.on('take-photo', function(msg) {
    takePhoto(msg.boardId);
});
