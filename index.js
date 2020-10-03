require('dotenv').config({path: 'config/.env'});

/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload: the ID of the property.
 * @param {!Object} context Metadata for the event.
 */
exports.main = async (event, context) => {
    const propertyId = event.data ? Buffer.from(event.data, "base64").toString() : "";
    const url = `https://api.housfy.com/api/user/v1/public/properties/${propertyId}/appointment-availability`;

    if (!validURL(url)) {
        console.log(`URL is not valid: ${url}. Aborting.`);
        return;
    }

    const appointmentStatus = await getAppointmentAvailability();

    if (appointmentStatus.body.message === "Property not visitable") {
        console.log(`Appointments are not available for ${url}. Aborting.`);
    } else {
        sendEmail(appointmentStatus);
    }

    async function getAppointmentAvailability() {
        const fetch = require('node-fetch');
        const options = {"method": "GET", "headers": {"authorization": `Bearer ${process.env.HOUSFY_BEARER_TOKEN}`}};
        const statusCode = await fetch(url, options).then(response => response.status);
        const body = await fetch(url, options).then(response => response.json());
        return {
            statusCode: statusCode,
            body: body
        }
    }

    function sendEmail() {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        const recipients = process.env.EMAIL_TO.split(",").map(email => {
            return {email: email.trim()}
        });
        let msg = {
            personalizations: [{
                to: recipients
            }],
            from: {
                email: process.env.EMAIL_FROM,
                name: "El bot de Angel"
            }
        };

        if (appointmentStatus.statusCode === 200) {
            console.log(`Appointments are available for ${url}! Proceeding to prepare email notification...`);
            msg = {
                ...msg,
                subject: 'YA SE PUEDEN HACER VISITAS',
                text: `CORRE, YA SE PUEDEN HACER VISITAS EN ${url}`,
                html: `<strong>CORRE, YA SE PUEDEN HACER VISITAS EN <a href="https://housfy.com/appointment/${propertyId}">https://housfy.com/appointment/${propertyId}</a></strong>`
            }
        } else {
            console.log(`Property ${url} response is neither visitable nor not visitable. Check if the API is broken. Proceeding to prepare email notification...`);
            msg = {
                ...msg,
                subject: 'ALGO RARO PASA CON ESTE PISO',
                text: `La llamada a ${url} no devolvió ni un 200 OK, ni un "Propiedad no visitable". Revisar la llamada, probablemente haya un error que impide conocer la disponibilidad del piso. Error: ${appointmentStatus.statusCode}. Body: ${JSON.stringify(appointmentStatus.body)}`,
                html: `La llamada a <a href=${url}>${url}</a> no devolvió ni un 200 OK, ni un "Propiedad no visitable". Revisar la llamada, probablemente haya un error que impide conocer la disponibilidad del piso.<br>Error: ${appointmentStatus.statusCode}<br>Body: ${JSON.stringify(appointmentStatus.body)}`
            }
        }

        sgMail.send(msg);
    }

    function validURL(str) {
        const pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
            '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
            '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
        return !!pattern.test(str);
    }
};