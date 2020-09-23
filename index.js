require('dotenv').config({path: 'config/.env'});

/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
exports.helloPubSub = async (event, context) => {
    const url = event.data ? Buffer.from(event.data, "base64").toString() : "";

    if (!validURL(url)) {
        console.log(`There is no URL passed on the PubSub cron payload: ${url}. Aborting.`);
        return;
    }

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();

    const response = await page.goto(url, {waitUntil: "load"});

    if (response.headers().status !== "200") {
        console.log(`Status code for page ${url} is not 200: ${response.headers().status}. Aborting.`);
        await browser.close();
        return;
    }

    const pageText = await page.evaluate(() => {
        return document.getElementsByTagName("body")[0].innerText;
    });

    await browser.close();

    if (pageText.includes("Esta propiedad no tiene actualmente disponibilidad")) {
        console.log(`Page ${url} doesn't allow to schedule appointments. Aborting.`);
        return;
    }

    sendEmail();

    function sendEmail() {
        console.log(`Appointments are available for ${url}! Proceeding to prepare email notification...`);

        const sgMail = require('@sendgrid/mail')
        sgMail.setApiKey(process.env.SENDGRID_API_KEY)

        const recipients = process.env.EMAIL_TO.split(",").map(email => {
            return {
                email: email.trim()
            }
        })

        const msg = {
            personalizations: [{
                to: recipients
            }],
            from: process.env.EMAIL_FROM,
            subject: 'YA SE PUEDEN HACER VISITAS',
            text: `CORRE, YA SE PUEDEN HACER VISITAS EN ${url}`,
            html: `<strong>CORRE, YA SE PUEDEN HACER VISITAS EN <a href=${url}>${url}</a></strong>`
        }

        sgMail.send(msg);
    }

    function validURL(str) {
        const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
            '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
            '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
        return !!pattern.test(str);
    }
};