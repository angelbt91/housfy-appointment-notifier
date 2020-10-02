require('dotenv').config({path: 'config/.env'});

/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
exports.helloPubSub = async (event, context) => {
    const propertyId = event.data ? Buffer.from(event.data, "base64").toString() : "";
    const url = `https://api.housfy.com/api/user/v1/public/properties/${propertyId}/appointment-availability`;

    if (!validURL(url)) {
        console.log(`URL is not valid: ${url}. Aborting.`);
        return;
    }

    const fetch = require('node-fetch');
    const options = {
        "method": "GET",
        "headers": {
            "authorization": `Bearer ${process.env.HOUSFY_BEARER_TOKEN}`
        }
    }

    await fetch(url, options).then(response => {
        if (response.status === 200) {
            sendEmail();
        } else {
            console.log(`Status code for ${url} is not 200: ${response.status}. Aborting.`);
        }
    }).catch(err => {
        console.error("An error ocurred when fetching availability:", err);
    });

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
            from: {
                email: process.env.EMAIL_FROM,
                name: "El bot de Angel"
            },
            subject: 'YA SE PUEDEN HACER VISITAS',
            text: `CORRE, YA SE PUEDEN HACER VISITAS EN ${url}`,
            html: `<strong>CORRE, YA SE PUEDEN HACER VISITAS EN <a href="https://housfy.com/appointment/${propertyId}">https://housfy.com/appointment/${propertyId}</a></strong>`
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