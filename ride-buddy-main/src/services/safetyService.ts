import { toast } from "sonner";

const API_KEY = import.meta.env.VITE_FAST2SMS_API_KEY;

interface SOSData {
    latitude: number | null;
    longitude: number | null;
    passengerName: string;
    passengerPhone: string;
    driverName: string;
    driverPhone: string;
    vehicleNumber: string;
    vehicleType: string;
    emergencyContacts: { name: string; phone: string }[];
}

export const sendSOSAlert = async (data: SOSData) => {
    if (!API_KEY) {
        console.error("Fast2SMS API Key missing. Please restart your dev server.");
        toast.error("Safety service configuration error.");
        return false;
    }

    const {
        latitude,
        longitude,
        passengerName,
        passengerPhone,
        driverName,
        driverPhone,
        vehicleNumber,
        vehicleType,
        emergencyContacts,
    } = data;

    const locText = latitude && longitude
        ? `Location: https://www.google.com/maps?q=${latitude},${longitude}`
        : "Location: Unknown (Live Tracking Active)";

    const message = `🚨 EMERGENCY 🚨\nPass: ${passengerName}\nDriver: ${driverName}\nVeh: ${vehicleType} - ${vehicleNumber}\n${locText}`;

    console.log("Transmitting SOS via Proxy...");

    // 1. Alert Emergency Contacts
    if (emergencyContacts.length > 0) {
        for (const contact of emergencyContacts) {
            await sendMessage(contact.phone, message);
        }
    } else {
        // 2. Initial alert to passenger if no contacts added
        await sendMessage(passengerPhone, `🚨 SOS Activated! Details shared with emergency system. ${locText}`);
        toast.info("Initial alert message sent (No emergency contacts found).");
    }

    return true;
};

const sendMessage = async (recipient: string, body: string) => {
    // Clean number to be 10 digits for Fast2SMS (India)
    const cleanNumber = recipient.replace(/\D/g, "").slice(-10);

    if (cleanNumber.length !== 10) {
        console.warn(`Skipping invalid phone number: ${recipient}`);
        return false;
    }

    try {
        // Using the local proxy /api/fast2sms to bypass CORS
        const response = await fetch("/api/fast2sms", {
            method: "POST",
            headers: {
                "authorization": API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "route": "q",
                "message": body,
                "language": "english",
                "numbers": cleanNumber,
            }),
        });

        const result = await response.json();
        if (result.return) {
            console.log(`SOS Message successfully sent to ${cleanNumber}`);
            return true;
        } else {
            console.error(`Fast2SMS Error for ${cleanNumber}:`, result);
            return false;
        }
    } catch (error) {
        console.error(`Network Error sending SOS:`, error);
        return false;
    }
};
