# Known limitations and future work

- Photon, Nominatim and OSRM public endpoints are demo services and may throttle requests. Use managed/geocoding/routing infrastructure for production traffic.
- The live browser workflow, real Atlas writes, Socket.IO connections and geolocation permissions must be tested on the target machine before submission.
- Driver document references are currently stored as references/URLs; production should use secure object storage, access control and malware scanning.
- Schedule conflict checks protect recurring weekday/time windows, but production dispatch may need a dedicated availability calendar and configurable buffer times.
- The subscription fare is an estimate based on route distance and selected weekdays; actual traffic and detours can change travel time.
- Automated browser tests and CI integration are not yet configured.
