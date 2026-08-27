/* Configuración de Supabase
   ====================================
   INSTRUCCIONES:
   1. Crea un proyecto en supabase.com
   2. Ve a Project Settings > API
   3. Copia tu URL y Anon Key
   4. Reemplaza los valores abajo
   ====================================
*/

const SUPABASE_URL = 'https://uuzcnutnqiliwjiwtepw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1emNudXRucWlsaXdqaXd0ZXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTY2MzgsImV4cCI6MjA4OTYzMjYzOH0.rokwj01qX7d1IUw8qzQl3u62zzMIpnLIrLJ4Ghe9LIw';

// Panel admin - Contraseña protegida
const ADMIN_PASSWORD = 'admin123'; // Cambia por una contraseña fuerte

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_PASSWORD };
}
