using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dentist.Api.Data.Configurations;

public sealed class SmsMessageConfiguration : IEntityTypeConfiguration<SmsMessage>
{
    public void Configure(EntityTypeBuilder<SmsMessage> builder)
    {
        builder.ToTable("SmsMessages");
        builder.HasKey(message => message.Id);

        builder.Property(message => message.Message).HasMaxLength(480).IsRequired();
        builder.Property(message => message.SentAt).HasDefaultValueSql("NOW()");

        builder.HasOne(message => message.Appointment)
            .WithMany(appointment => appointment.SmsMessages)
            .HasForeignKey(message => message.AppointmentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Non-unique index so an appointment can receive multiple scheduled reminders over time
        builder.HasIndex(message => message.AppointmentId);
    }
}
