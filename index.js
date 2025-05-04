const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require("baileys");
const pino = require("pino");
const cron = require("node-cron");
require("dotenv").config();
const db = require("./service/database");

// Ganti dengan nomor telepon Anda (dengan kode negara, contoh: 628xxxxxxxxxx)
const nomorTeleponAnda = process.env.OWNER_WA;

async function connectToWhatsApp(nomorTeleponAnda) {
    const useCode = true;
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: !useCode
    });

    if (useCode && !sock.user && !sock.authState.creds.registered) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const code = await sock.requestPairingCode(nomorTeleponAnda);
        console.log(`Your Code: ${code}`);
    }

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "close") {
            const { statusCode } = lastDisconnect.error.output;
            if (statusCode === 515) {
                await connectToWhatsApp(nomorTeleponAnda);
            }
            console.log(lastDisconnect.error);
        }
        if (connection === "open") {
            const now = new Date();

            cron.schedule(
                "50 22 * * *",
                async () => {
                    // kirim pesanPengingat

                    await sendReminderDrug(sock);
                },
                {
                    scheduled: true,
                    timezone: "Asia/Jakarta"
                }
            );
        }
    });
    sock.ev.on("creds.update", saveCreds);

    return sock;
}

async function kirimPesanWhatsApp(sock, nomorPenerima, pesan) {
    try {
        const jid = `62${nomorPenerima}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: pesan });
        console.log(`Pesan berhasil dikirim ke ${nomorPenerima}: ${pesan}`);
    } catch (error) {
        console.error("Gagal mengirim pesan:", error);
    }
}

const sendReminderDrug = async sock => {
    const { data: users, error } = await db.from("users").select("*");

    for (const user of users) {
        const { data: drugs, error } = await db
            .from("drugs")
            .select("*")
            .eq("user_id", user.id);

        for (const drug of drugs) {
            // check total_obat & hitung mundur otomatis
            let newTotalObat = drug.total_obat - drug.sekali_berapa;
            if (drug.total_obat <= 0) {
                newTotalObat = 0;
                const { error: drugDeleteError } = await db
                    .from("drugs")
                    .delete()
                    .eq("id", drug.id);
                console.log(
                    "Obat yang habis berhasil di hapus: ",
                    drug.nama_obat
                );
            }

            // pesanPengingat
            const pesanPengingat = `*HAI ${user.username}*
=========================
Saatnya minum obat _*${drug.nama_obat}*_
sesuai ketentuan: ${drug.ketentuan_obat}.
Dosis: ${drug.sekali_berapa}x dalam ${drug.sehari_berapa}x sehari.

Obat Tersisa: ${newTotalObat}

> Bot: Pil Reminder WhatsApp`;
            try {
                const jid = `62${user.phone}@s.whatsapp.net`;
                await sock.sendMessage(jid, { text: pesanPengingat });
                console.log(`Pesan berhasil dikirim ke +${user.phone}:\n${pesanPengingat}`);
            } catch (error) {
                console.error("Gagal mengirim pesan:", error);
            }

            const { error: newDrugValError, error } = await db
                .from("drugs")
                .update({ total_obat: newTotalObat })
                .eq("id", drug.id);

            if (newDrugValError) {
                console.error(error);
            }

            console.log("\nTotal obat diperbarui:", newTotalObat);
        }
    }
};

async function WARun(nomorPenerima, pesanPengingat) {
    const sock = await connectToWhatsApp(nomorTeleponAnda);
    console.log(`Meminta kode pairing untuk nomor: ${nomorTeleponAnda}.`);
    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
            const now = new Date();
            console.info("Berhasil terhubung ke WhatsApp", nomorTeleponAnda);
            cron.schedule("0 7 * * *", async () => {
                console.log("Oke");
                await sendReminderDrug(sock);
            });
            cron.schedule("0 14 * * *", async () => {
                console.log("Oke");
                await sendReminderDrug(sock);
            });
            cron.schedule("0 19 * * *", async () => {
                console.log("Oke");
                await sendReminderDrug(sock);
            });
        }
    });
}

// userGreating
const date = new Date();
function userGreating() {
    const great = ["Pagi", "Siang", "Sore", "Malam", "Petang"];
    const currentHours = date.getHours();

    // Logic
    if (currentHours <= 5) {
        return `Selamat ${great[4]}`;
    } else if (currentHours >= 5) {
        return `Selamat ${great[0]}`;
    } else if (currentHours >= 10) {
        return `Selamat ${great[1]}`;
    } else if (currentHours >= 15) {
        return `Selamat ${great[2]}`;
    } else if (currentHours >= 19) {
        return `Selamat ${great[3]}`;
    }
}

// const data = async () => {};

WARun();
