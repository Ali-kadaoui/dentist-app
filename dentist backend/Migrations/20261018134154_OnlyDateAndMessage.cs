using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dentist.Api.Migrations
{
    /// <inheritdoc />
    public partial class OnlyDateAndMessage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Treatments");

            migrationBuilder.DropIndex(
                name: "IX_SmsMessages_SentAt",
                table: "SmsMessages");

            migrationBuilder.DropIndex(
                name: "IX_PatientStates_PatientId_CreatedAt",
                table: "PatientStates");

            migrationBuilder.DropColumn(
                name: "ErrorDetail",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "SentAt",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "To",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "PatientStates");

            migrationBuilder.DropColumn(
                name: "EndsAt",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "Reason",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Appointments");

            migrationBuilder.RenameColumn(
                name: "StartsAt",
                table: "Appointments",
                newName: "Date");

            migrationBuilder.RenameIndex(
                name: "IX_Appointments_StartsAt",
                table: "Appointments",
                newName: "IX_Appointments_Date");

            migrationBuilder.RenameIndex(
                name: "IX_Appointments_PatientId_StartsAt",
                table: "Appointments",
                newName: "IX_Appointments_PatientId_Date");

            migrationBuilder.CreateIndex(
                name: "IX_PatientStates_PatientId",
                table: "PatientStates",
                column: "PatientId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PatientStates_PatientId",
                table: "PatientStates");

            migrationBuilder.RenameColumn(
                name: "Date",
                table: "Appointments",
                newName: "StartsAt");

            migrationBuilder.RenameIndex(
                name: "IX_Appointments_PatientId_Date",
                table: "Appointments",
                newName: "IX_Appointments_PatientId_StartsAt");

            migrationBuilder.RenameIndex(
                name: "IX_Appointments_Date",
                table: "Appointments",
                newName: "IX_Appointments_StartsAt");

            migrationBuilder.AddColumn<string>(
                name: "ErrorDetail",
                table: "SmsMessages",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SentAt",
                table: "SmsMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "SmsMessages",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "To",
                table: "SmsMessages",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "PatientStates",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<DateOnly>(
                name: "EndsAt",
                table: "Appointments",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Appointments",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Reason",
                table: "Appointments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Appointments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "Treatments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    PerformedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Tooth = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Treatments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Treatments_Appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalTable: "Appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Treatments_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SmsMessages_SentAt",
                table: "SmsMessages",
                column: "SentAt");

            migrationBuilder.CreateIndex(
                name: "IX_PatientStates_PatientId_CreatedAt",
                table: "PatientStates",
                columns: new[] { "PatientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Treatments_AppointmentId",
                table: "Treatments",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Treatments_PatientId_PerformedAt",
                table: "Treatments",
                columns: new[] { "PatientId", "PerformedAt" });
        }
    }
}
