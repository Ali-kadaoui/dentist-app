using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dentist.Api.Data.Configurations;

public sealed class DentalTreatmentConfiguration : IEntityTypeConfiguration<DentalTreatment>
{
    public void Configure(EntityTypeBuilder<DentalTreatment> builder)
    {
        builder.ToTable("DentalTreatments");
        builder.HasKey(t => t.Id);

        builder.HasOne(t => t.Patient)
            .WithMany()
            .HasForeignKey(t => t.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(t => t.ToothNumbers).HasMaxLength(100).IsRequired();
        builder.Property(t => t.ActName).HasMaxLength(250).IsRequired();
        builder.Property(t => t.Status).HasMaxLength(50).IsRequired();
        builder.Property(t => t.Notes);

        builder.HasIndex(t => t.PatientId);
        builder.HasIndex(t => t.Date);
    }
}
