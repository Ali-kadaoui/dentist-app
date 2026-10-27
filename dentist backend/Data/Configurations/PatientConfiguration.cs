using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dentist.Api.Data.Configurations;

public sealed class PatientConfiguration : IEntityTypeConfiguration<Patient>
{
    public void Configure(EntityTypeBuilder<Patient> builder)
    {
        builder.ToTable("Patients");
        builder.HasKey(patient => patient.Id);

        builder.Property(patient => patient.FirstName).HasMaxLength(80).IsRequired();
        builder.Property(patient => patient.LastName).HasMaxLength(80).IsRequired();
        builder.Property(patient => patient.Phone).HasMaxLength(32).IsRequired();
        builder.Property(patient => patient.Profession).HasMaxLength(120);
        builder.Property(patient => patient.Cin).HasMaxLength(50);
        builder.Property(patient => patient.Address).HasMaxLength(255);
        builder.Property(patient => patient.Email).HasMaxLength(160);
        builder.Property(patient => patient.Gender).HasMaxLength(20);
        builder.Property(patient => patient.Notes).HasMaxLength(2000);

        builder.Ignore(patient => patient.Age);
        builder.Ignore(patient => patient.FullName);

        builder.HasIndex(patient => patient.Cin);
        builder.HasIndex(patient => patient.Phone);
        builder.HasIndex(patient => new { patient.LastName, patient.FirstName });
    }
}
