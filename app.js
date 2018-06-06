'use strict';

const dir = '/home/pi/ulc-camera/';
const config = require('config');
const aws = require('aws-sdk');
const cp = require('child_process');
const fs = require('fs');
const io = require('socket.io-client');
const cameraId = config.get('cameraId');

aws.config.region = 'us-west-2';

const socket = io.connect(
  'ulc-relay.herokuapp.com',
  { port: 80 }
);

function takePhoto(boardId) {
  let cmd = cp.exec(
    '/usr/bin/fswebcam --no-banner -r 1920x1080 --jpeg 90 /home/pi/ulc-camera/board-image.jpg -S 30'
  );
  cmd.on('exit', () => {
    let body = fs.createReadStream(dir + 'board-image.jpg');
    let s3 = new aws.S3({
      params: {
        Bucket: 'ulc.the816.co',
        Key: `${boardId}-${cameraId}-${Date.now()}.jpg`,
        ContentType: 'image/jpeg',
        Body: body
      }
    });
    s3.upload().send((err, data) => {
      socket.emit('take-photo-complete', {
        url: data.Location,
        boardId: boardId,
        cameraId: cameraId
      });
    });
  });
}

let heartbeat = setInterval(() => {
  socket.emit('heartbeat', {
    time: Date.now(),
    cameraId: cameraId
  });
}, 1000);

socket.on('deploy', msg => {
  if (parseInt(msg.cameraId) !== cameraId) return;
  clearInterval(heartbeat);
  cp.execSync('cd ' + dir + ' && git pull');
  cp.exec('sudo reboot');
});

socket.on('reboot', msg => {
  if (parseInt(msg.cameraId) !== cameraId) return;
  clearInterval(heartbeat);
  cp.exec('sudo reboot');
});

socket.on('shutdown', msg => {
  if (parseInt(msg.cameraId) !== cameraId) return;
  clearInterval(heartbeat);
  cp.exec('sudo shutdown -h now');
});

socket.on('take-photo', msg => {
  if (parseInt(msg.cameraId) !== cameraId) return;
  takePhoto(msg.boardId);
});
