using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dentist.Api.Data.Configurations;

public sealed class PatientStateConfiguration : IEntityTypeConfiguration<PatientState>
{
    public void Configure(EntityTypeBuilder<PatientState> builder)
    {
        builder.ToTable("PatientStates");
        builder.HasKey(state => state.Id);

        builder.Property(state => state.Problem).HasMaxLength(1000).IsRequired();
        builder.Property(state => state.Progress).HasMaxLength(2000).IsRequired();

        builder.HasOne(state => state.Patient)
            .WithMany(patient => patient.PatientStates)
            .HasForeignKey(state => state.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(state => state.PatientId);
    }
}
