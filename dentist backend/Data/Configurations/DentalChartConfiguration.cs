using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dentist.Api.Data.Configurations;

public sealed class DentalChartConfiguration : IEntityTypeConfiguration<DentalChart>
{
    public void Configure(EntityTypeBuilder<DentalChart> builder)
    {
        builder.ToTable("DentalCharts");
        builder.HasKey(c => c.Id);

        builder.HasOne(c => c.Patient)
            .WithOne()
            .HasForeignKey<DentalChart>(c => c.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(c => c.DentitionMode).HasMaxLength(50).IsRequired();
        builder.Property(c => c.TeethDataJson).IsRequired();

        builder.HasIndex(c => c.PatientId).IsUnique();
    }
}
