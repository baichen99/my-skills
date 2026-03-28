
import requests
from bs4 import BeautifulSoup
import re
import json

def parse_readhub_daily(content):
    """解析 Readhub 每日早报内容"""
    news_list = []
    soup = BeautifulSoup(content, 'lxml')
    
    # 找到新闻列表容器
    news_items = soup.find_all('article', class_='style-module-scss-module__nqqBCq__article')
    
    for item in news_items:
        # 提取标题
        title = item.find('div', class_='style-module-scss-module__nqqBCq__title').get_text(strip=True)
        # 提取链接
        link = item.find('a', class_='style-module-scss-module__nqqBCq__link')['href']
        # 提取摘要
        summary = item.find('div', class_='style-module-scss-module__nqqBCq__summary').get_text(strip=True)
        
        # 处理标题中的编号（如 "01"）
        title = re.sub(r'^0*\d+', '', title).strip()
        
        news_list.append({
            'title': title,
            'url': 'https://readhub.cn' + link,
            'summary': summary,
            'source': 'Readhub 每日早报'
        })
    
    return news_list

def parse_readhub_ai(content):
    """解析 Readhub AI 新闻内容"""
    news_list = []
    soup = BeautifulSoup(content, 'lxml')
    
    # 找到新闻列表容器
    news_items = soup.find_all('div', class_='style-module-scss-module__U5RJeW__pc')
    
    # 由于 Readhub AI 新闻页面结构复杂，需要从脚本中提取数据
    script_tag = soup.find('script', string=lambda x: x and 'articles' in x)
    if script_tag:
        script_content = script_tag.string
        
        # 提取 articles 数据
        articles_match = re.search(r'"articles":\s*(\[.*?\])', script_content)
        if articles_match:
            articles_data = json.loads(articles_match.group(1))
            
            for article in articles_data:
                news_list.append({
                    'title': article['title'],
                    'url': 'https://readhub.cn/topic/' + article['id'],
                    'summary': article['summary'],
                    'source': 'Readhub AI 新闻'
                })
    
    return news_list

def parse_juya_ai(content):
    """解析 Juya AI 早报内容"""
    news_list = []
    soup = BeautifulSoup(content, 'lxml')
    
    # 找到新闻列表
    post_content = soup.find('div', class_='post-content')
    if post_content:
        # 找到所有标题和链接
        for heading in post_content.find_all('h2'):
            # 提取标题和链接
            link = heading.find('a')
            if link:
                title = heading.get_text(strip=True).replace('#', '').strip()
                url = link['href']
                
                # 优化微信文章链接处理
                if "mp.weixin.qq.com" in url:
                    # 尝试从微信文章链接中获取更多信息
                    # 或者考虑是否需要跳过微信文章，只保留其他来源的内容
                    # 目前我们会保留，但可以在将来进一步优化
                    pass
                
                # 提取摘要（查找标题下的第一个段落）
                summary = ''
                next_sibling = heading.next_sibling
                while next_sibling and (next_sibling.name not in ['h2', 'h1']):
                    if next_sibling.name == 'p':
                        summary = next_sibling.get_text(strip=True)
                        break
                    next_sibling = next_sibling.next_sibling
                
                news_list.append({
                    'title': title,
                    'url': url,
                    'summary': summary,
                    'source': 'Juya AI 早报'
                })
    
    return news_list

def deduplicate_news(news_list):
    """去除重复新闻"""
    seen_titles = set()
    unique_news = []
    
    for news in news_list:
        title = news['title']
        # 简化标题以提高去重准确性
        simplified_title = re.sub(r'[^\w\s]', '', title).strip().lower()
        
        if simplified_title not in seen_titles:
            seen_titles.add(simplified_title)
            unique_news.append(news)
    
    return unique_news

def classify_news(title):
    """对新闻进行分类（简单分类）"""
    title_lower = title.lower()
    
    if 'ai' in title_lower or '人工智能' in title_lower or '模型' in title_lower:
        return '【AI 动态】'
    elif 'coding' in title_lower or '编程' in title_lower or '代码' in title_lower:
        return '【编程技术】'
    elif '产品' in title_lower or '应用' in title_lower or '服务' in title_lower:
        return '【产品应用】'
    elif '企业' in title_lower or '公司' in title_lower or '商业' in title_lower:
        return '【企业动态】'
    elif '开源' in title_lower or '生态' in title_lower or '开发' in title_lower:
        return '【开发生态】'
    else:
        return '【科技新闻】'

def generate_daily_report(news_list):
    """生成每日报告"""
    report = []
    
    for i, news in enumerate(news_list, 1):
        classification = classify_news(news['title'])
        report.append(f"{i}.{classification} [{news['title']}] [{news['url']}]")
    
    return '\n'.join(report)

def main():
    # 读取抓取到的内容
    with open('readhub_daily.txt', 'r', encoding='utf-8') as f:
        readhub_daily_content = f.read()
    
    with open('readhub_ai.txt', 'r', encoding='utf-8') as f:
        readhub_ai_content = f.read()
    
    with open('juya_ai.txt', 'r', encoding='utf-8') as f:
        juya_ai_content = f.read()
    
    # 解析新闻
    readhub_daily_news = parse_readhub_daily(readhub_daily_content)
    readhub_ai_news = parse_readhub_ai(readhub_ai_content)
    juya_ai_news = parse_juya_ai(juya_ai_content)
    
    # 合并新闻
    all_news = readhub_daily_news + readhub_ai_news + juya_ai_news
    
    # 去重
    unique_news = deduplicate_news(all_news)
    
    # 筛选重要新闻（取前 10 条）
    important_news = unique_news[:10]
    
    # 生成报告
    report = generate_daily_report(important_news)
    
    # 输出报告
    print(report)
    
    # 保存报告到文件
    with open('ai-daily-report.txt', 'w', encoding='utf-8') as f:
        f.write(report)

if __name__ == "__main__":
    main()
