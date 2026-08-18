import fetch from 'node-fetch';
import fs from 'fs';

const GROUP_NAME = 'dostigenie_deti';
const POSTS_COUNT = 10;

async function fetchPosts() {
    console.log('Начинаем парсинг постов из группы vk.ru/dostigenie_deti...');
    
    const url = `https://vk.ru/${GROUP_NAME}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        fs.writeFileSync('/workspace/scripts/debug.html', html);
        console.log('HTML сохранен в scripts/debug.html для анализа');
        
        const posts = [];
        const postRegex = /<article[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
        let match;
        let count = 0;
        
        while ((match = postRegex.exec(html)) !== null && count < POSTS_COUNT) {
            const postHtml = match[1];
            
            const textMatch = postHtml.match(/<div[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            const text = textMatch ? cleanHtml(textMatch[1]) : '';
            
            const dateMatch = postHtml.match(/<time[^>]*datetime="([^"]*)"[^>]*>([^<]*)<\/time>/i);
            const date = dateMatch ? dateMatch[1] : new Date().toISOString();
            
            const images = [];
            const imgRegex = /<img[^>]*src="([^"]*)"[^>]*>/gi;
            let imgMatch;
            while ((imgMatch = imgRegex.exec(postHtml)) !== null) {
                if (imgMatch[1].startsWith('http')) {
                    images.push(imgMatch[1]);
                }
            }
            
            const postIdMatch = postHtml.match(/data-post-id="(\d+)"/i);
            const postId = postIdMatch ? postIdMatch[1] : `${Date.now()}-${count}`;
            
            if (text.trim()) {
                posts.push({
                    id: postId,
                    text: text,
                    date: date,
                    images: images.slice(0, 5),
                    url: `https://vk.ru/wall-${postId}`
                });
                count++;
            }
        }
        
        console.log(`Найдено постов: ${posts.length}`);
        return posts;
        
    } catch (error) {
        console.error('Ошибка при парсинге:', error.message);
        return [];
    }
}

function cleanHtml(html) {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 1000);
}

async function main() {
    const posts = await fetchPosts();
    
    if (posts.length === 0) {
        console.log('Посты не найдены через парсинг. Создаю демо-данные.');
        posts.push({
            id: 'demo-1',
            text: 'Добро пожаловать на сайт "Достижение Дети"! Здесь мы публикуем наши достижения и новости.',
            date: new Date().toISOString(),
            images: [],
            url: 'https://vk.ru/dostigenie_deti'
        });
    }
    
    fs.writeFileSync('/workspace/src/data/posts.json', JSON.stringify(posts, null, 2));
    console.log('Данные сохранены в src/data/posts.json');
    console.log('Первый пост:', JSON.stringify(posts[0], null, 2));
}

main();
