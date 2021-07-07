@echo off
:loop
title FirebirdFarmingBot
echo Starting Firebird Farming Bot v1
node main.js
timeout /t 5
goto loop
