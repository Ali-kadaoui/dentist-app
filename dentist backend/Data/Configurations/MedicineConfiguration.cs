using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dentist.Api.Data.Configurations;

public sealed class MedicineConfiguration : IEntityTypeConfiguration<Medicine>
{
    public void Configure(EntityTypeBuilder<Medicine> builder)
    {
        builder.ToTable("Medicines");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Name).HasMaxLength(160).IsRequired();
        builder.Property(m => m.Dosage).HasMaxLength(100);
        builder.Property(m => m.Form).HasMaxLength(100);
        builder.Property(m => m.Category).HasMaxLength(100).IsRequired();
        builder.Property(m => m.DefaultDosageInstructions).HasMaxLength(300);
        builder.Property(m => m.Notes);

        builder.HasIndex(m => m.Name);
        builder.HasIndex(m => m.Category);
    }
}
