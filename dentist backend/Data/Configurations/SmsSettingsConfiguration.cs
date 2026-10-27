using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dentist.Api.Data.Configurations;

public sealed class SmsSettingsConfiguration : IEntityTypeConfiguration<SmsSettings>
{
    public void Configure(EntityTypeBuilder<SmsSettings> builder)
    {
        builder.ToTable("SmsSettings");
        builder.HasKey(settings => settings.Id);

        builder.Property(settings => settings.ReminderTemplate).HasMaxLength(480).IsRequired();
        builder.Property(settings => settings.BookingTemplate).HasMaxLength(480).IsRequired();
        builder.Property(settings => settings.RemindersJson).HasDefaultValue("[{\"daysBefore\":1,\"time\":\"18:00\"}]");

        builder.HasData(new SmsSettings
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            AutoSendEnabled = false,
            SendOnBooking = false,
            SendReminderBefore = true,
            DaysBefore = 1,
            SendHour = 18,
            SendMinute = 0,
            MaxReminders = 1,
            RemindersJson = "[{\"daysBefore\":1,\"time\":\"18:00\"}]",
            ReminderTemplate = "Bonjour {firstName}, rappel : votre rendez-vous au cabinet dentaire est prevu le {date}. Merci de confirmer.",
            BookingTemplate = "Bonjour {firstName}, votre rendez-vous au cabinet dentaire a ete reserve pour le {date}.",
        });
    }
}
