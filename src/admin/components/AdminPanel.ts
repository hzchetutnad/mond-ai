export const AdminPanel = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Мондей | Админ панель</title>
  <style>
    :root {
      --bg: #0f0f0f;
      --accent: #8774e1;
      --text: #e1e3e6;
      --system-bg: #2d2d2d;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: var(--system-bg);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: var(--accent);
      margin: 10px 0;
    }

    .users-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }

    .users-table th,
    .users-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid var(--system-bg);
    }

    .users-table th {
      background: var(--system-bg);
      font-weight: normal;
    }

    button {
      background: var(--accent);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }

    button:hover {
      opacity: 0.9;
    }

    button.danger {
      background: #e74c3c;
    }

    .search {
      background: var(--system-bg);
      border: none;
      padding: 10px;
      border-radius: 6px;
      color: var(--text);
      width: 100%;
      max-width: 300px;
      margin-bottom: 20px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: var(--accent);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Админ панель</h1>
    
    <div class="stats">
      <div class="stat-card">
        <div>Всего пользователей</div>
        <div class="stat-value" id="totalUsers">-</div>
      </div>
      <div class="stat-card">
        <div>Premium пользователей</div>
        <div class="stat-value" id="premiumUsers">-</div>
      </div>
      <div class="stat-card">
        <div>Всего сообщений</div>
        <div class="stat-value" id="totalMessages">-</div>
      </div>
    </div>

    <input type="text" class="search" placeholder="Поиск пользователей..." id="search">
    
    <div id="usersTable"></div>
  </div>

  <script>
    const ADMIN_TOKEN = localStorage.getItem('adminToken');
    const TELEGRAM_ID = localStorage.getItem('telegramId');
    
    if (!ADMIN_TOKEN || !TELEGRAM_ID) {
      const token = prompt('Введите админ токен:');
      const id = prompt('Введите ваш Telegram ID:');
      if (token && id) {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('telegramId', id);
        location.reload();
      } else {
        document.body.innerHTML = '<div class="container"><h1>Доступ запрещен</h1></div>';
      }
    }

    async function fetchWithAuth(url, options = {}) {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'adminToken': ADMIN_TOKEN,
          'telegramId': localStorage.getItem('telegramId'),
          'Content-Type': 'application/json'
        }
      });
    }

    // Загрузка статистики
    async function loadStats() {
      try {
        const response = await fetchWithAuth('/admin/stats');
        const stats = await response.json();
        
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('premiumUsers').textContent = stats.premiumUsers;
        document.getElementById('totalMessages').textContent = stats.totalMessages;
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    }

    // Загрузка пользователей
    async function loadUsers() {
      try {
        const response = await fetchWithAuth('/admin/users');
        const users = await response.json();
        
        const searchTerm = document.getElementById('search').value.toLowerCase();
        const filteredUsers = users.filter(user => 
          user.id.toLowerCase().includes(searchTerm)
        );

        const table = \`
          <table class="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Сообщений</th>
                <th>Premium</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              \${filteredUsers.map(user => \`
                <tr>
                  <td>\${user.id}</td>
                  <td>\${user.messageCount}</td>
                  <td>\${user.isSubscribed === 'true' ? '✅' : '❌'}</td>
                  <td>
                    <button onclick="toggleSubscription('\${user.id}', \${user.isSubscribed !== 'true'})">
                      \${user.isSubscribed === 'true' ? 'Отключить' : 'Включить'} Premium
                    </button>
                    <button class="danger" onclick="clearHistory('\${user.id}')">
                      Очистить историю
                    </button>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;

        document.getElementById('usersTable').innerHTML = table;
      } catch (error) {
        console.error('Error loading users:', error);
      }
    }

    // Управление подпиской
    async function toggleSubscription(userId, isSubscribed) {
      try {
        await fetchWithAuth(\`/admin/users/\${userId}/subscription\`, {
          method: 'POST',
          body: JSON.stringify({ isSubscribed })
        });
        
        loadStats();
        loadUsers();
      } catch (error) {
        console.error('Error toggling subscription:', error);
      }
    }

    // Очистка истории
    async function clearHistory(userId) {
      if (!confirm('Точно очистить историю этого пользователя?')) return;
      
      try {
        await fetchWithAuth(\`/admin/users/\${userId}/history\`, {
          method: 'DELETE'
        });
        
        loadUsers();
      } catch (error) {
        console.error('Error clearing history:', error);
      }
    }

    // Инициализация
    loadStats();
    loadUsers();
    
    // Поиск
    document.getElementById('search').addEventListener('input', loadUsers);
  </script>
</body>
</html>
`; 