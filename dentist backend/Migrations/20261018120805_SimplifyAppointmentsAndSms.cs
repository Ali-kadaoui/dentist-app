using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dentist.Api.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyAppointmentsAndSms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Old free-number rows have no appointment to hang off; they cannot
            // survive the switch to a required, unique AppointmentId.
            migrationBuilder.Sql("DELETE FROM \"SmsMessages\" WHERE \"AppointmentId\" IS NULL;");

            migrationBuilder.DropForeignKey(
                name: "FK_SmsMessages_Appointments_AppointmentId",
                table: "SmsMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_SmsMessages_Patients_PatientId",
                table: "SmsMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_SmsMessages_ReminderRules_ReminderRuleId",
                table: "SmsMessages");

            migrationBuilder.DropTable(
                name: "ReminderRules");

            migrationBuilder.DropIndex(
                name: "IX_SmsMessages_AppointmentId_ReminderRuleId",
                table: "SmsMessages");

            migrationBuilder.DropIndex(
                name: "IX_SmsMessages_CreatedAt",
                table: "SmsMessages");

            migrationBuilder.DropIndex(
                name: "IX_SmsMessages_PatientId",
                table: "SmsMessages");

            migrationBuilder.DropIndex(
                name: "IX_SmsMessages_ReminderRuleId",
                table: "SmsMessages");

            migrationBuilder.DropIndex(
                name: "IX_SmsMessages_Status_CreatedAt",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Treatments");

            migrationBuilder.DropColumn(
                name: "Attempts",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "ErrorCode",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "PatientId",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "ProviderMessageId",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "ProviderRequestId",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "ReminderRuleId",
                table: "SmsMessages");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Appointments");

            migrationBuilder.AlterColumn<Guid>(
                name: "AppointmentId",
                table: "SmsMessages",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateOnly>(
                name: "StartsAt",
                table: "Appointments",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<DateOnly>(
                name: "EndsAt",
                table: "Appointments",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.CreateTable(
                name: "PatientStates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Problem = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Progress = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PatientStates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PatientStates_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SmsMessages_AppointmentId",
                table: "SmsMessages",
                column: "AppointmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SmsMessages_SentAt",
                table: "SmsMessages",
                column: "SentAt");

            migrationBuilder.CreateIndex(
                name: "IX_PatientStates_PatientId_CreatedAt",
                table: "PatientStates",
                columns: new[] { "PatientId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_SmsMessages_Appointments_AppointmentId",
                table: "SmsMessages",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SmsMessages_Appointments_AppointmentId",
                table: "SmsMessages");

            migrationBuilder.DropTable(
                name: "PatientStates");

            migrationBuilder.DropIndex(
                name: "IX_SmsMessages_AppointmentId",
                table: "SmsMessages");

            migrationBuilder.DropIndex(
                name: "IX_SmsMessages_SentAt",
                table: "SmsMessages");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "Treatments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AlterColumn<Guid>(
                name: "AppointmentId",
                table: "SmsMessages",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<int>(
                name: "Attempts",
                table: "SmsMessages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "SmsMessages",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "ErrorCode",
                table: "SmsMessages",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PatientId",
                table: "SmsMessages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProviderMessageId",
                table: "SmsMessages",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProviderRequestId",
                table: "SmsMessages",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReminderRuleId",
                table: "SmsMessages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "Patients",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "StartsAt",
                table: "Appointments",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "EndsAt",
                table: "Appointments",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "Appointments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "Appointments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.CreateTable(
                name: "ReminderRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    OffsetDays = table.Column<int>(type: "integer", nullable: false),
                    Template = table.Column<string>(type: "character varying(480)", maxLength: 480, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReminderRules", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SmsMessages_AppointmentId_ReminderRuleId",
                table: "SmsMessages",
                columns: new[] { "AppointmentId", "ReminderRuleId" });

            migrationBuilder.CreateIndex(
                name: "IX_SmsMessages_CreatedAt",
                table: "SmsMessages",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SmsMessages_PatientId",
                table: "SmsMessages",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_SmsMessages_ReminderRuleId",
                table: "SmsMessages",
                column: "ReminderRuleId");

            migrationBuilder.CreateIndex(
                name: "IX_SmsMessages_Status_CreatedAt",
                table: "SmsMessages",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ReminderRules_IsActive_OffsetDays",
                table: "ReminderRules",
                columns: new[] { "IsActive", "OffsetDays" });

            migrationBuilder.AddForeignKey(
                name: "FK_SmsMessages_Appointments_AppointmentId",
                table: "SmsMessages",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SmsMessages_Patients_PatientId",
                table: "SmsMessages",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SmsMessages_ReminderRules_ReminderRuleId",
                table: "SmsMessages",
                column: "ReminderRuleId",
                principalTable: "ReminderRules",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
