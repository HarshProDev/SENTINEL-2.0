# SENTINEL 2.0 - Electrical Safety & Non-Medical Warning

## 1. Electrical Isolation & Human Body Contact

> **MANDATORY ELECTRICAL SAFETY WARNING:**
> You are attaching conductive metal electrodes and photodiode sensors directly to human skin.
> **DO NOT connect skin electrodes to an ESP32 that is plugged into an ungrounded or questionable mains-powered USB wall charger.**
> 
> **Safe Operating Procedure:**
> 1. Power your ESP32 and laptop from a **battery-powered laptop** (disconnected from the AC wall charger while electrodes are attached) OR from an **isolated 5V USB portable power bank**.
> 2. Ensure all sensor wires are insulated.
> 3. Verify with a digital multimeter that the voltage between either GSR electrode and true ground does not exceed 3.3V DC.
> 4. If at any time a participant experiences tingling, heating, or discomfort, immediately disconnect the electrodes.

---

## 2. Non-Medical Prototype Disclaimer

* **Student Engineering Demonstration:** SENTINEL 2.0 is developed as an academic exploration of embedded signal acquisition, digital filtering, and real-time IoT architecture.
* **Not a Medical Device:** It has not been tested, cleared, or approved by the FDA, CE-MDR, CDSCO, or any medical regulatory authority.
* **No Diagnostic Validity:** It must never be used to diagnose, prevent, treat, or monitor any disease, arrhythmia, cardiac arrest, hypertension, or psychological condition.
* **Sensor Limitations:** Optical pulse sensors are highly susceptible to motion artifacts, ambient light pollution (especially fluorescent lights and direct sunlight), skin tone variations, and capillary perfusion changes. GSR signals are influenced by sweat electrolyte concentration, room humidity, physical pressure, and movement.
