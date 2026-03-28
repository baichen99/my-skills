#!/usr/bin/env python3
"""
信息源一键添加工具，自动生成基础Site Recipe。

用法:
  python scripts/feed_submitter.py add <url> [--name <站点名称>]
  python scripts/feed_submitter.py list
  python scripts/feed_submitter.py verify <site-id>
"""

import argparse
import json
import os
import re
import sys
import yaml
from pathlib import Path
from urllib.parse import urlparse

# 站点Recipe目录
SITE_RECIPES_DIR = Path(__file__).parent.parent / "site-recipes"

def generate_site_id(url: str, name: str = None) -> str:
    """从URL或名称生成站点ID"""
    if name:
        base = name.lower()
    else:
        parsed = urlparse(url)
        base = parsed.netloc

    # 清理特殊字符
    base = re.sub(r'[^a-z0-9]+', '-', base)
    base = base.strip('-')

    # 确保ID唯一
    counter = 1
    site_id = base
    while (SITE_RECIPES_DIR / f"{site_id}.yaml").exists():
        site_id = f"{base}-{counter}"
        counter += 1

    return site_id

def detect_site_type(url: str) -> str:
    """自动检测站点类型"""
    lower_url = url.lower()
    if any(ext in lower_url for ext in ['.xml', '.rss', '.atom', '/feed', '/rss']):
        return 'rss'
    if 'api.' in lower_url or '/api/' in lower_url:
        return 'api'
    return 'html'

def generate_recipe(url: str, name: str = None) -> dict:
    """生成基础Recipe模板"""
    site_id = generate_site_id(url, name)
    site_type = detect_site_type(url)
    parsed = urlparse(url)

    recipe = {
        'id': site_id,
        'name': name or parsed.netloc.replace('www.', ''),
        'description': f"信息源: {name or url}",
        'access': {
            'url': url,
            'needsBrowser': True,
            'waitFor': {
                'selector': 'body',
                'timeout': 10000
            }
        },
        'extraction': {
            'listSelector': '',
            'fallbackSelectors': {
                'listSelector': [
                    'main article',
                    '.news-list > div',
                    '.post-item',
                    '.article-item',
                    'ul li'
                ]
            },
            'fields': {
                'title': {
                    'selector': 'h1, h2, h3, .title',
                    'type': 'text',
                    'fallbackSelectors': ['.news-title', '.post-title', '.article-title']
                },
                'url': {
                    'selector': 'a',
                    'type': 'attribute',
                    'attribute': 'href',
                    'transform': 'resolveUrl',
                    'baseUrl': f"{parsed.scheme}://{parsed.netloc}",
                    'fallbackSelectors': ['h1 a', 'h2 a', 'h3 a', '.title a']
                },
                'publishedAt': {
                    'selector': 'time, .date, .publish-time',
                    'type': 'attribute',
                    'attribute': 'datetime',
                    'optional': True,
                    'fallbackSelectors': ['.time', '.post-date', '.article-date']
                },
                'description': {
                    'selector': '.description, .summary, .excerpt',
                    'type': 'text',
                    'optional': True,
                    'fallbackSelectors': ['.content p:first-child', '.post-excerpt', '.article-summary']
                }
            }
        },
        'customHeaders': {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': f"{parsed.scheme}://{parsed.netloc}/"
        },
        'rateLimit': 1,
        'notes': f"自动生成的基础模板，需要根据实际页面结构调整选择器。\n站点类型: {site_type}"
    }

    # RSS类型特殊配置
    if site_type == 'rss':
        recipe['extraction']['listSelector'] = 'item, entry'
        recipe['access']['needsBrowser'] = True  # 仍然使用Agent Browser获取

    return recipe

def add_feed(url: str, name: str = None) -> None:
    """添加新的信息源"""
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    recipe = generate_recipe(url, name)
    recipe_path = SITE_RECIPES_DIR / f"{recipe['id']}.yaml"

    with open(recipe_path, 'w', encoding='utf-8') as f:
        yaml.dump(recipe, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    print(f"✅ 新信息源已添加: {recipe['id']}")
    print(f"📝 配置文件: {recipe_path}")
    print(f"⚠️  请根据实际页面结构调整extraction中的选择器配置")

def list_feeds() -> None:
    """列出所有已配置的信息源"""
    print("📋 已配置的信息源:")
    print("-" * 60)

    for recipe_file in sorted(SITE_RECIPES_DIR.glob("*.yaml")):
        with open(recipe_file, 'r', encoding='utf-8') as f:
            recipe = yaml.safe_load(f)

        status = "✅ 健康"  # 未来可以加入健康检查
        print(f"{recipe['id']:<25} {recipe['name']:<30} {status}")
        print(f"  URL: {recipe['access']['url']}")
        print()

def verify_feed(site_id: str) -> None:
    """验证站点Recipe是否有效"""
    recipe_path = SITE_RECIPES_DIR / f"{site_id}.yaml"
    if not recipe_path.exists():
        print(f"❌ 站点 {site_id} 不存在")
        return

    with open(recipe_path, 'r', encoding='utf-8') as f:
        recipe = yaml.safe_load(f)

    print(f"🔍 正在验证 {recipe['name']} ({recipe['id']})")
    print(f"URL: {recipe['access']['url']}")
    print()

    # 基础校验
    errors = []
    if not recipe.get('access', {}).get('url'):
        errors.append("缺少access.url配置")
    if not recipe.get('extraction', {}).get('listSelector'):
        errors.append("缺少extraction.listSelector配置，请手动设置")

    required_fields = ['title', 'url']
    for field in required_fields:
        if field not in recipe.get('extraction', {}).get('fields', {}):
            errors.append(f"缺少必填字段: {field}")

    if errors:
        print("❌ 配置存在问题:")
        for err in errors:
            print(f"  - {err}")
    else:
        print("✅ 基础配置校验通过")
        print("💡 建议手动运行一次抓取测试验证选择器是否正确")

def main():
    parser = argparse.ArgumentParser(description="信息源管理工具")
    subparsers = parser.add_subparsers(dest='command', required=True)

    # add 命令
    add_parser = subparsers.add_parser('add', help='添加新的信息源')
    add_parser.add_argument('url', help='信息源URL')
    add_parser.add_argument('--name', help='站点名称（可选）')

    # list 命令
    list_parser = subparsers.add_parser('list', help='列出所有已配置的信息源')

    # verify 命令
    verify_parser = subparsers.add_parser('verify', help='验证站点配置是否有效')
    verify_parser.add_argument('site_id', help='站点ID')

    args = parser.parse_args()

    # 确保站点目录存在
    SITE_RECIPES_DIR.mkdir(exist_ok=True)

    if args.command == 'add':
        add_feed(args.url, args.name)
    elif args.command == 'list':
        list_feeds()
    elif args.command == 'verify':
        verify_feed(args.site_id)

if __name__ == "__main__":
    main()
