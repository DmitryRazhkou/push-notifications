const https = require('https');
const express = require('express');
const webPush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());

const vapidKeys = {
  publicKey: 'BMzYsREuowwsagFyE9aujreVSMWxS97ixij4muQRFkFVk9YuXEn3I_n6V65E4X9Il7qduEwRNnyHCGEDju0RqFY',
  privateKey: 'FnbO8BvmUcUBJi71ezm3pzoCpeEzKqEIp9eX99X9Yxg',
};

webPush.setVapidDetails(
  'mailto:rozhkow.dimas@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const subscriptions = [];

app.post('/subscribe', (req, res) => {
  const subscription = req.body;

  subscriptions.push(subscription);

  res.status(201).json({ message: 'Подписка получена.' });
});
console.log('subscriptions', subscriptions);

app.post('/sendNotification', (req, res) => {
  const { title, message } = req.body;
  console.log(title, message);
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }
  console.log('subscriptions', subscriptions);

  const notificationPayload = JSON.stringify({
    title: title || 'NEW NOTIFICATION',
    body: message || 'Notification using Push API',
    icon: '/investra-192-192.png',
  });

  console.log('Sending notifications with payload:', notificationPayload);

  const promises = subscriptions.map((subscription) => {
    return webPush.sendNotification(subscription, notificationPayload)
      .then(() => {
        console.log(`Notification sent successfully to subscription: ${subscription.endpoint}`);
      })
      .catch((error) => {
        console.error(`Error sending notification to subscription: ${subscription.endpoint}`, error);
      });
  });

  Promise.all(promises)
    .then(() => {
      console.log('All notifications sent successfully');
      res.sendStatus(200);
    })
    .catch((error) => {
      console.error('Error sending notifications:', error);
      res.sendStatus(500);
    });
});

const options = {
  key: fs.readFileSync('./private.key', 'utf8'),
  cert: fs.readFileSync('./certificate.crt', 'utf8'),
};

const PORT = 8000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
