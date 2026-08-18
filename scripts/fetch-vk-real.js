import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

// ID группы "Достижение Дети" нужно найти или использовать домен
// Попробуем через метод wall.get, но нам нужен access_token.
// Для начала попробуем получить данные через публичный API VK (без токена работает ограниченно)
// Или используем mock-данные, если API недоступен без токена.

const GROUP_DOMAIN = 'dostigenie_deti';
const COUNT = 10;

async function fetchVkPosts() {
    console.log(`🔍 Пытаемся получить посты из группы ${GROUP_DOMAIN}...`);
    
    // ВНИМАНИЕ: Без токена VK API может не отдать данные стены.
    // Обычно нужен service_token. 
    // Попробуем запрос к версии API 5.131
    const token = process.env.VK_TOKEN || ''; // Можно передать токен через env
    
    const url = `https://api.vk.com/method/wall.get?domain=${GROUP_DOMAIN}&count=${COUNT}&v=5.131${token ? `&access_token=${token}` : ''}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            throw new Error(`VK API Error: ${data.error.error_msg}`);
        }

        const posts = data.response.items.filter(item => item.id > 0 && !item.marked_as_ads); // Фильтруем рекламу и репосты от имени других, если нужно

        const formattedPosts = posts.map(post => {
            // Обработка текста (заменяем переносы строк на <br> для HTML или оставляем как есть для Astro)
            let text = post.text || '';
            
            // Обработка изображений
            let imageUrl = null;
            if (post.attachments && post.attachments.length > 0) {
                const photo = post.attachments.find(a => a.type === 'photo');
                if (photo && photo.photo) {
                    // Берем самое большое доступное изображение
                    imageUrl = photo.photo.sizes.reduce((prev, current) => 
                        (prev.width > current.width) ? prev : current
                    ).url;
                }
            }

            return {
                id: post.id,
                title: text.split('\n')[0].slice(0, 60) + (text.length > 60 ? '...' : ''), // Первая строка как заголовок
                date: new Date(post.date * 1000).toISOString(),
                content: text,
                image: imageUrl,
                sourceUrl: `https://vk.com/wall-${post.owner_id}_${post.id}`,
                slug: post.id.toString()
            };
        });

        return formattedPosts;

    } catch (error) {
        console.error('❌ Ошибка при получении данных:', error.message);
        console.log('💡 Подсказка: Возможно, нужен токен VK. Создай сервисный ключ в https://vk.com/dev/apps и передай его как VK_TOKEN.');
        return null;
    }
}

async function main() {
    const posts = await fetchVkPosts();

    if (!posts || posts.length === 0) {
        console.log('⚠️ Не удалось получить реальные посты. Оставляем демо-данные или создаем заглушку.');
        // Если не получилось, можно вернуть ошибку или оставить старые данные
        process.exit(1);
    }

    console.log(`✅ Получено ${posts.length} постов.`);

    // Сохраняем как JSON для удобства
    const jsonPath = path.join(ROOT_DIR, 'src', 'data', 'posts.json');
    fs.writeFileSync(jsonPath, JSON.stringify(posts, null, 2));
    console.log(`📄 Данные сохранены в ${jsonPath}`);

    // Генерируем TS файл
    const tsContent = `export interface Post {
  id: number;
  title: string;
  date: string;
  content: string;
  image: string | null;
  sourceUrl: string;
  slug: string;
}

export const postsData: Post[] = ${JSON.stringify(posts, null, 2)};
`;
    const tsPath = path.join(ROOT_DIR, 'src', 'data', 'postsData.ts');
    fs.writeFileSync(tsPath, tsContent);
    console.log(`📄 TypeScript файл обновлен: ${tsPath}`);

    console.log('🚀 Готово! Теперь сделай commit и push, чтобы Vercel обновил сайт.');
}

main();
