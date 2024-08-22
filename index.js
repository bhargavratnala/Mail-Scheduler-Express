const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

// create database with file name schedule.db
const db = new sqlite3.Database('schedule.db');

const mail = process.env.APP_MAIL;
const gmailpass = process.env.APP_PASSWD;
const from_mail = process.env.APP_FROM_MAIL || mail;

// create table
db.run('CREATE TABLE schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, schedule BIGINT, status INTEGER DEFAULT 0)', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Table created');
});

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    // return form with email and date and time input
    res.send(`
        <form action="/schedule" method="post">
            <input type="email" name="email" placeholder="Email" required />
            <input type="datetime-local" name="schedule" required />
            <button type="submit">Schedule</button>
        </form>
    `);
});

app.post('/schedule', (req, res) => {
    const { email, schedule } = req.body;
    const time = new Date(schedule).getTime();
    // insert email and schedule into database
    db.run('INSERT INTO schedule (email, schedule) VALUES (?, ?)', [email, time], (err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Email scheduled');
    });
    res.redirect('/');
});

// create mail transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: mail,
        pass: gmailpass
    }
});

// schedule mail sending
cron.schedule('* * * * *', () => {
    console.log('checking for emails to send');
    // get current date and time
    const now = new Date().getTime();
    // select emails to send
    let query = `SELECT * FROM schedule WHERE schedule <= '${now}' AND status = 0`;
    db.all(query, (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        console.log(rows.length);
        rows.forEach(row => {
            // send mail
            transporter.sendMail({
                from: from_mail,
                to: row.email,
                subject: 'Scheduled Mail',
                text: 'This is a scheduled mail.'
            }, (err, info) => {
                if (err) {
                    return console.error(err.message);
                }
                console.log(`Email sent: ${info.response}`);
                // update status to 1
                db.run('UPDATE schedule SET status = 1 WHERE id = ?', [row.id], (err) => {
                    if (err) {
                        return console.error(err.message);
                    }
                    console.log('Email status updated');
                });
            }
            );
        }
        );
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});