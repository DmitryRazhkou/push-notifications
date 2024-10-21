const https = require('https');
const express = require('express');
const webPush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors());
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

let subscriptions = []; // Локальное хранилище подписок

// Middleware для проверки наличия сессии
function checkSession(req, res, next) {
  const session = req.query.session; // Сессия передается в query параметре
  if (!session) {
    return res.status(401).json({ error: 'Session token is required' });
  }
  req.session = session;
  next();
}

// Получение подписок с Directual API и синхронизация с локальными подписками
async function syncSubscriptions(session) {
  console.log('Начало синхронизации подписок с Directual API...'); // Логирование начала запроса
  console.log('Токен сессии:', session); // Логирование токена сессии
  try {
    const response = await axios.get('https://api.directual.com/good/api/v7/webpushes_subscribers', {
      headers: {
        Authorization: `Bearer ${session}`,
      },
    });

    console.log('Ответ от Directual API syncSubscriptions:', response.data); // Логирование ответа от Directual API

    const directualSubscriptions = response.data.payload;

    // Логирование данных, которые пришли от Directual API
    console.log('Ответ от Directual API:', directualSubscriptions);

    subscriptions = directualSubscriptions.map((sub) => ({
      endpoint: sub.pushNotificationId,
      userId: sub.userId,
    }));

    console.log('Синхронизированные подписки:', subscriptions); // Логирование синхронизированных подписок
  } catch (error) {
    console.error('Ошибка при синхронизации подписок:', error); // Логирование ошибки
  }
}

// Роут для подписки и добавления в Directual API
app.post('/subscribe', checkSession, async (req, res) => {
  const subscription = req.body;

  const existingSubscription = subscriptions.some(
    (sub) => sub.endpoint === subscription.endpoint
  );

  if (existingSubscription) {
    return res.status(409).json({ message: 'Подписка уже существует.' });
  }

  // Добавляем подписку в локальный список
  subscriptions.push(subscription);
  console.log('Новая подписка добавлена локально:', subscription);

  try {
    // Отправляем подписку на Directual API
    const response = await axios.post(
      'https://api.directual.com/good/api/v5/data/webpushes_subscribers/v1_back_webpushes_webpushes_subscribers_subscribe',
      {
        pushNotificationId: subscription.endpoint,
        userId: subscription.userId || 'default_user_id', // Замените userId на актуальный ID пользователя
      },
      {
        headers: {
          Authorization: `Bearer ${req.session}`, // Передача токена сессии в заголовках
        },
      }
    );

    console.log('Подписка отправлена на Directual:', response.data);

    // Синхронизируем подписки после успешного добавления
    await syncSubscriptions(req.session);

    res.status(201).json({ message: 'Подписка успешно добавлена и синхронизирована.' });
  } catch (error) {
    console.error('Ошибка при отправке подписки на Directual:', error);
    res.status(500).json({ error: 'Ошибка при добавлении подписки' });
  }
});

// Роут для отправки уведомлений
app.post('/sendNotification', (req, res) => {
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  const notificationPayload = JSON.stringify({
    title: title || 'NEW NOTIFICATION',
    body: message || 'Notification using Push API',
    icon: '/investra-192-192.png',
  });

  const promises = subscriptions.map((subscription) => {
    return webPush.sendNotification(subscription, notificationPayload)
      .then(() => {
        console.log(`Уведомление успешно отправлено: ${subscription.endpoint}`);
      })
      .catch((error) => {
        console.error(`Ошибка при отправке уведомления на подписку: ${subscription.endpoint}`, error);
      });
  });

  Promise.all(promises)
    .then(() => {
      console.log('Все уведомления успешно отправлены');
      res.sendStatus(200);
    })
    .catch((error) => {
      console.error('Ошибка при отправке уведомлений:', error);
      res.sendStatus(500);
    });
});

// Запуск синхронизации при старте сервера
app.get('/syncSubscriptions', checkSession, async (req, res) => {
  try {
    console.log('Запрос синхронизации подписок от клиента...'); // Логирование запроса синхронизации
    await syncSubscriptions(req.session);
    res.status(200).json({ message: 'Подписки синхронизированы.' });
  } catch (error) {
    console.error('Ошибка при синхронизации через роут:', error);
    res.status(500).json({ error: 'Ошибка при синхронизации подписок.' });
  }
});

// Функция для получения session token
async function getSessionToken() {
  try {
    console.log('Отправляем запрос на получение session token...');
    
    const response = await axios.post(`https://api.directual.com/good/api/v5/auth?appID=3cf35b4f-e1cf-48a4-94ad-0956906eb36b`, 
      {
        provider: "rest",
        username: "webpush",
        password: 'webpushWebpush@123'
      }
    );    

    console.log('Ответ от Directual:', response.data);
    return response.data.result.token;
  } catch (error) {
    console.error('Ошибка при получении session token:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Настройки HTTPS сервера
const options = {
  key: fs.readFileSync('./private.key', 'utf8'),
  cert: fs.readFileSync('./certificate.crt', 'utf8'),
};

const PORT = 8000;
https.createServer(options, app).listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);

  try {
    // Получение session token и синхронизация подписок при старте сервера
    const sessionToken = await getSessionToken();
    await syncSubscriptions(sessionToken);
    console.log('Подписки успешно синхронизированы при старте сервера.');
  } catch (error) {
    console.error('Ошибка при получении session token или синхронизации подписок при старте сервера:', error);
  }
});
