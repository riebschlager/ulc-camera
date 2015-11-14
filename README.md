Add a config.js file that looks a lil' something like this.

```javascript
module.exports = {
    cameraId: 0
};
```

Add to crontab:

```bash
sudo crontab -e
@reboot /usr/bin/sudo -u pi -H /usr/local/bin/forever start /home/pi/blvdia-camera/app.js
```
