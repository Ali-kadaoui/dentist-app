@echo off
title Dentist App Stopper
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
pause
