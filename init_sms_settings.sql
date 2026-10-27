DROP TABLE IF EXISTS "SmsSettings" CASCADE;
DROP TABLE IF EXISTS smssettings CASCADE;
CREATE TABLE "SmsSettings" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "AutoSendEnabled" boolean NOT NULL DEFAULT false,
    "SendOnBooking" boolean NOT NULL DEFAULT false,
    "SendReminderBefore" boolean NOT NULL DEFAULT true,
    "DaysBefore" integer NOT NULL DEFAULT 1,
    "SendHour" integer NOT NULL DEFAULT 9,
    "ReminderTemplate" character varying(480) NOT NULL,
    "BookingTemplate" character varying(480) NOT NULL
);
INSERT INTO "SmsSettings" ("Id", "AutoSendEnabled", "SendOnBooking", "SendReminderBefore", "DaysBefore", "SendHour", "ReminderTemplate", "BookingTemplate")
VALUES ('00000000-0000-0000-0000-000000000001', false, false, true, 1, 9, 'Bonjour {firstName}, rappel : votre rendez-vous au cabinet dentaire est prevu le {date}. Merci de confirmer.', 'Bonjour {firstName}, votre rendez-vous au cabinet dentaire a ete reserve pour le {date}.');
