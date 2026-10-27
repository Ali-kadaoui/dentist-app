using Dentist.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Dentist.Api.Data;

/// <summary>
/// Single EF Core context for the dashboard. Mappings live in
/// <see cref="Configurations"/> so the context stays a thin registry.
/// </summary>
public sealed class DentistDbContext(DbContextOptions<DentistDbContext> options) : DbContext(options)
{
    public DbSet<Patient> Patients => Set<Patient>();

    public DbSet<Appointment> Appointments => Set<Appointment>();

    public DbSet<PatientState> PatientStates => Set<PatientState>();

    public DbSet<SmsMessage> SmsMessages => Set<SmsMessage>();

    public DbSet<SmsSettings> SmsSettings => Set<SmsSettings>();

    public DbSet<Payment> Payments => Set<Payment>();

    public DbSet<Medicine> Medicines => Set<Medicine>();

    public DbSet<DentalTreatment> DentalTreatments => Set<DentalTreatment>();

    public DbSet<DentalChart> DentalCharts => Set<DentalChart>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DentistDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
