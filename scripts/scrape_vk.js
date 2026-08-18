import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Открываем группу VK...');
  await page.goto('https://vk.ru/dostigenie_deti', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Даем время на загрузку динамического контента
  await page.waitForTimeout(5000);

  // Ждем появления постов
  await page.waitForSelector('.PostView', { timeout: 10000 }).catch(() => {
    console.log('Не удалось найти .PostView, пробуем альтернативный селектор...');
  });

  // Ищем посты (селекторы могут отличаться, пробуем несколько вариантов)
  const postSelectors = [
    '.PostView',
    '.wall_post',
    '[data-post-id]',
    '.post',
    'article'
  ];

  let postsElements = [];
  for (const selector of postSelectors) {
    postsElements = await page.$$(selector);
    if (postsElements.length > 0) {
      console.log(`Найдено постов по селектору "${selector}": ${postsElements.length}`);
      break;
    }
  }

  if (postsElements.length === 0) {
    console.log('Посты не найдены. Сохраняем HTML для отладки.');
    await page.content().then(html => fs.writeFileSync('/workspace/debug_vk.html', html));
    await browser.close();
    return;
  }

  const posts = [];
  
  for (let i = 0; i < Math.min(postsElements.length, 3); i++) {
    const postEl = postsElements[i];
    
    try {
      // Извлекаем данные
      const text = await postEl.$eval('.PostView__textContent, .wall_post_text, .post_text, .text_content', el => el.innerText.trim()).catch(() => '');
      
      // Дата
      let dateStr = await postEl.$eval('.PostView__metaTime, .post_date, .relative_time, time', el => el.getAttribute('datetime') || el.innerText.trim()).catch(() => '');
      if (!dateStr) {
        dateStr = new Date().toISOString();
      }

      // Заголовок (берем первую строку текста или генерируем)
      const title = text.split('\n')[0].substring(0, 50) + (text.length > 50 ? '...' : '') || `Пост #${i+1}`;

      // Изображение
      let imageUrl = null;
      try {
        const imgEl = await postEl.$('img.PostView__img, img.wall_post_img, img.post_img, .PostView__media img');
        if (imgEl) {
          imageUrl = await imgEl.getAttribute('src');
        }
      } catch (e) {
        console.log('Изображение не найдено');
      }

      // Ссылка на пост
      let postLink = 'https://vk.ru/dostigenie_deti';
      try {
        const linkEl = await postEl.$('a.PostView__linkToPost, a.post_link, a[href*="/wall"]');
        if (linkEl) {
          const href = await linkEl.getAttribute('href');
          if (href && href.startsWith('http')) {
            postLink = href;
          } else if (href) {
            postLink = `https://vk.ru${href}`;
          }
        }
      } catch (e) {
        console.log('Ссылка не найдена');
      }

      // ID поста (генерируем уникальный)
      const postId = Date.now() - i;

      posts.push({
        id: postId,
        title: title,
        date: dateStr,
        text: text,
        imageUrl: imageUrl,
        link: postLink,
        slug: `post-${postId}`
      });

      console.log(`\n--- Пост ${i+1} ---`);
      console.log('Заголовок:', title);
      console.log('Дата:', dateStr);
      console.log('Текст (первые 100 символов):', text.substring(0, 100) + '...');
      console.log('Изображение:', imageUrl || 'нет');
      console.log('Ссылка:', postLink);
    } catch (error) {
      console.error(`Ошибка при парсинге поста ${i}:`, error.message);
    }
  }

  await browser.close();

  if (posts.length > 0) {
    // Сохраняем в JSON
    const dataPath = path.join('/workspace', 'src', 'data', 'postsData.ts');
    const content = `export interface Post {\n  id: number;\n  title: string;\n  date: string;\n  text: string;\n  imageUrl?: string;\n  link: string;\n  slug: string;\n}\n\nexport const postsData: Post[] = ${JSON.stringify(posts, null, 2)};`;
    
    fs.writeFileSync(dataPath, content);
    console.log(`\n✅ Успешно спарсено ${posts.length} пост(а/ов)!`);
    console.log('Данные сохранены в:', dataPath);
  } else {
    console.log('❌ Не удалось спарсить ни одного поста.');
  }
})();
