const express = require('express');
const webPush = require('web-push');
const bodyParser = require('body-parser');

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

app.post('/sendNotification', (req, res) => {
  const notificationPayload = JSON.stringify({
    title: 'NEW NOTIFICATION',
    body: 'Notification using Push API',
    icon: '/investra-192-192.png',
  });

  const promises = subscriptions.map(subscription => {
    return webPush.sendNotification(subscription, notificationPayload)
      .catch(error => console.error('Error', error));
  });

  Promise.all(promises).then(() => res.sendStatus(200));
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
