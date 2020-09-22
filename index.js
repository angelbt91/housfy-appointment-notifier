const puppeteer = require('puppeteer');
require('dotenv').config()

/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
exports.helloPubSub = async (event, context) => {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    const response = await page.goto(process.env.URL_TO_CHECK, {waitUntil: "load"});

    if (response.headers().status !== "200") {
        console.log(`Status code for page ${process.env.URL_TO_CHECK} is not 200: ${response.headers().status}. Aborting.`);
        await browser.close();
        return;
    }

    const pageText = await page.evaluate(() => {
        return document.getElementsByTagName("body")[0].innerText;
    });

    await browser.close();

    if (pageText.includes("Esta propiedad no tiene actualmente disponibilidad")) {
        console.log(`Page ${process.env.URL_TO_CHECK} doesn't allow to schedule appointments. Aborting.`);
        return;
    }

    sendEmail();

    function sendEmail() {
        console.log("Appointments are working! Sending email notifications...");
        // TODO Add email sending logic
    }
};

