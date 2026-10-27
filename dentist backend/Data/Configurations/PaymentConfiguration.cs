using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dentist.Api.Data.Configurations;

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments");
        builder.HasKey(p => p.Id);

        builder.HasOne(p => p.Patient)
            .WithMany()
            .HasForeignKey(p => p.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(p => p.Treatment).HasMaxLength(200).IsRequired();
        builder.Property(p => p.TotalAmount).HasPrecision(12, 2);
        builder.Property(p => p.PaidAmount).HasPrecision(12, 2);
        builder.Property(p => p.PaymentMethod).HasMaxLength(50).IsRequired();
        builder.Property(p => p.Status).HasMaxLength(30).IsRequired();
        builder.Property(p => p.Notes);

        builder.Ignore(p => p.RemainingAmount);

        builder.HasIndex(p => p.PatientId);
        builder.HasIndex(p => p.PaymentDate);
        builder.HasIndex(p => p.Status);
    }
}
