using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dentist.Api.Data.Configurations;

public sealed class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
{
    public void Configure(EntityTypeBuilder<Appointment> builder)
    {
        builder.ToTable("Appointments");
        builder.HasKey(appointment => appointment.Id);

        builder.HasOne(appointment => appointment.Patient)
            .WithMany(patient => patient.Appointments)
            .HasForeignKey(appointment => appointment.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(appointment => appointment.Date);
        builder.HasIndex(appointment => new { appointment.PatientId, appointment.Date });

        builder.Property(appointment => appointment.LastSmsStatus).HasMaxLength(32);
        builder.Property(appointment => appointment.LastSmsError);
        builder.Property(appointment => appointment.LastSmsAttemptAt);
    }
}
