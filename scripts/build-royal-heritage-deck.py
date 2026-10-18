import os
import sys
import glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

DECK_DIR = 'public/decks/royal_heritage'
PIP_DIR = 'scripts/pips' if os.path.exists('scripts/pips') else DECK_DIR
ART_DIR = '/Users/Harsh/.gemini/antigravity/brain/f97ec65b-5994-4029-ae7d-08e5610a2bff'
os.makedirs(DECK_DIR, exist_ok=True)

cw, ch = 731, 1008
cx = cw // 2
col_l = 232
col_r = cw - col_l
CORNER_RADIUS = 28
MASK = Image.new('L', (cw, ch), 0)
ImageDraw.Draw(MASK).rounded_rectangle([(0, 0), (cw, ch)], radius=CORNER_RADIUS, fill=255)
WHITE_BG = Image.new('RGB', (cw, ch), (255, 255, 255))
CROP_BOX = (42, 139, 773, 1147)

# 1. Bespoke Engraved Gold Foil Numeral Generator
def create_bespoke_gold_numeral(text, size=(160, 140)):
    scale = 4
    sw, sh = size[0] * scale, size[1] * scale
    font_size = 140 * scale if text != '10' else 115 * scale
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Bodoni 72.ttc', size=font_size, index=2)
    
    mask_large = Image.new('L', (sw, sh), 0)
    draw_l = ImageDraw.Draw(mask_large)
    bbox = font.getbbox(text)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    
    if text == '10':
        b1 = font.getbbox('1')
        b0 = font.getbbox('0')
        w1, h1 = b1[2] - b1[0], b1[3] - b1[1]
        w0, h0 = b0[2] - b0[0], b0[3] - b0[1]
        gap = int(6 * scale)
        tot_w = w1 + gap + w0
        x_start = (sw - tot_w) // 2
        y_pos = (sh - h1) // 2
        draw_l.text((x_start - b1[0], y_pos - b1[1]), '1', font=font, fill=255)
        draw_l.text((x_start + w1 + gap - b0[0], y_pos - b0[1]), '0', font=font, fill=255)
    else:
        tx = (sw - tw) // 2 - bbox[0]
        ty = (sh - th) // 2 - bbox[1]
        draw_l.text((tx, ty), text, font=font, fill=255)
        
    grad_large = Image.new('RGBA', (sw, sh))
    for y in range(sh):
        t = y / float(sh)
        if t < 0.25:
            s = t / 0.25
            r = int(255 * (1 - s) + 242 * s)
            g = int(245 * (1 - s) + 215 * s)
            b = int(200 * (1 - s) + 140 * s)
        elif t < 0.65:
            s = (t - 0.25) / 0.40
            r = int(242 * (1 - s) + 215 * s)
            g = int(215 * (1 - s) + 168 * s)
            b = int(140 * (1 - s) + 75 * s)
        else:
            s = (t - 0.65) / 0.35
            r = int(215 * (1 - s) + 170 * s)
            g = int(168 * (1 - s) + 120 * s)
            b = int(75 * (1 - s) + 35 * s)
        for x in range(sw):
            grad_large.putpixel((x, y), (r, g, b, 255))
            
    gold_glyph = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    gold_glyph.paste(grad_large, (0, 0), mask_large)
    
    shadow_mask = mask_large.filter(ImageFilter.GaussianBlur(radius=scale * 1.5))
    shadow_im = Image.new('RGBA', (sw, sh), (12, 10, 6, 210))
    
    assembled = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    assembled.paste(shadow_im, (int(scale * 1.5), int(scale * 2.5)), shadow_mask)
    assembled.paste(gold_glyph, (0, 0), mask_large)
    
    if text == '10':
        bb = assembled.getbbox()
        cropped = assembled.crop(bb)
        condensed = cropped.resize((int(82 * scale), int(96 * scale)), Image.Resampling.LANCZOS)
        res_large = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
        res_large.paste(condensed, ((sw - condensed.width)//2, (sh - condensed.height)//2))
        return res_large.resize(size, Image.Resampling.LANCZOS)
        
    return assembled.resize(size, Image.Resampling.LANCZOS)

# 2. Geometric Pip Placements
def get_positions(rank):
    if rank == 2:
        return [(cx, 270, False), (cx, ch - 270, True)]
    elif rank == 3:
        return [(cx, 260, False), (cx, 504, False), (cx, ch - 260, True)]
    elif rank == 4:
        return [(col_l, 250, False), (col_r, 250, False), (col_l, ch - 250, True), (col_r, ch - 250, True)]
    elif rank == 5:
        return [(col_l, 240, False), (col_r, 240, False), (cx, 504, False), (col_l, ch - 240, True), (col_r, ch - 240, True)]
    elif rank == 6:
        return [
            (col_l, 240, False), (col_r, 240, False),
            (col_l, 504, False), (col_r, 504, False),
            (col_l, ch - 240, True), (col_r, ch - 240, True)
        ]
    elif rank == 7:
        return [
            (col_l, 235, False), (col_r, 235, False),
            (cx, 355, False),
            (col_l, 520, False), (col_r, 520, False),
            (col_l, ch - 235, True), (col_r, ch - 235, True)
        ]
    elif rank == 8:
        return [
            (col_l, 235, False), (col_r, 235, False),
            (cx, 355, False),
            (col_l, 504, False), (col_r, 504, False),
            (cx, ch - 355, True),
            (col_l, ch - 235, True), (col_r, ch - 235, True)
        ]
    elif rank == 9:
        return [
            (col_l, 220, False), (col_r, 220, False),
            (col_l, 395, False), (col_r, 395, False),
            (cx, 504, False),
            (col_l, ch - 395, True), (col_r, ch - 395, True),
            (col_l, ch - 220, True), (col_r, ch - 220, True)
        ]
    elif rank == 10:
        return [
            (col_l, 210, False), (col_r, 210, False),
            (cx, 310, False),
            (col_l, 400, False), (col_r, 400, False),
            (col_l, ch - 400, True), (col_r, ch - 400, True),
            (cx, ch - 310, True),
            (col_l, ch - 210, True), (col_r, ch - 210, True)
        ]

# 2.5 Morphological Color-Matched Inpainting
def erase_isolated_emblem(im, bbox, is_red=False):
    x1, y1, x2, y2 = bbox
    roi = np.array(im.crop(bbox), dtype=np.float32)
    
    if is_red:
        is_gold = (roi[:, :, 1] > 65) | (roi[:, :, 2] > 55)
        is_bg = (roi[:, :, 1] < 45) & (roi[:, :, 0] > 60)
        strip = np.array(im, dtype=np.float32)[300:412, 115:145]
    else:
        is_gold = (roi[:, :, 0] > 60) | (roi[:, :, 1] > 60)
        is_bg = (roi[:, :, 0] < 50) & (roi[:, :, 1] < 55) & (roi[:, :, 2] < 65)
        strip = np.array(im, dtype=np.float32)[260:372, 105:135]
        
    target_mean = roi[is_bg].mean(axis=0) if np.any(is_bg) else (np.array([105, 15, 25]) if is_red else np.array([33, 38, 42]))
    
    mask_im = Image.fromarray((is_gold.astype(np.uint8) * 255))
    mask_dilated = mask_im.filter(ImageFilter.MaxFilter(5))
    mask_feathered = mask_dilated.filter(ImageFilter.GaussianBlur(radius=1.5))
    
    w, h = x2 - x1, y2 - y1
    reps_x = (w // strip.shape[1]) + 3
    reps_y = (h // strip.shape[0]) + 3
    tiled = np.tile(strip, (reps_y, reps_x, 1))[:h, :w, :]
    tiled = tiled - tiled.mean(axis=(0, 1)) + target_mean
    tiled = np.clip(tiled, 0, 255).astype(np.uint8)
    
    im.paste(Image.fromarray(tiled), (x1, y1), mask_feathered)

# 3. Pristine Base Card Generator (Seamless Color-Matched Inpainting)
def build_master_base_pristine(suit):
    ace = Image.open(f'{DECK_DIR}/{suit}_A.jpg').convert('RGB')
    arr = np.array(ace, dtype=np.float32)
    is_red = (suit in ['hearts', 'diamonds'])
    
    strip_patch = arr[300:412, 115:145] if is_red else arr[260:372, 105:135]
    
    # 1. Clean TL rank 'A'
    tl_area = arr[24:136, 54:142]
    if not is_red:
        is_bg_tl = (tl_area[:, :, 0] < 50) & (tl_area[:, :, 1] < 60) & (tl_area[:, :, 2] < 70)
    else:
        is_bg_tl = (tl_area[:, :, 1] < 65) & (tl_area[:, :, 0] > 70)
    target_mean_tl = tl_area[is_bg_tl].mean(axis=0) if np.any(is_bg_tl) else (np.array([105, 15, 25]) if is_red else np.array([33, 38, 42]))
    
    tiled_tl = np.tile(strip_patch, (1, 3, 1))[:112, :88, :]
    tiled_tl = tiled_tl - tiled_tl.mean(axis=(0,1)) + target_mean_tl
    tiled_tl = np.clip(tiled_tl, 0, 255).astype(np.uint8)
    
    mask_tl = Image.new('L', (88, 112), 255)
    ImageDraw.Draw(mask_tl).rounded_rectangle([(3, 3), (85, 109)], radius=8, fill=255)
    mask_tl = mask_tl.filter(ImageFilter.GaussianBlur(radius=3.0))
    ace.paste(Image.fromarray(tiled_tl), (54, 24), mask_tl)
    
    # 2. Clean BR rank 'A'
    br_area = arr[865:975, 638:715]
    if not is_red:
        is_bg_br = (br_area[:, :, 0] < 50) & (br_area[:, :, 1] < 60) & (br_area[:, :, 2] < 70)
    else:
        is_bg_br = (br_area[:, :, 1] < 65) & (br_area[:, :, 0] > 70)
    target_mean_br = br_area[is_bg_br].mean(axis=0) if np.any(is_bg_br) else (np.array([105, 15, 25]) if is_red else np.array([33, 38, 42]))
    
    tiled_br = np.tile(strip_patch, (1, 3, 1))[:110, :77, :]
    tiled_br = tiled_br - tiled_br.mean(axis=(0,1)) + target_mean_br
    tiled_br = np.clip(tiled_br, 0, 255).astype(np.uint8)
    
    mask_br = Image.new('L', (77, 110), 255)
    ImageDraw.Draw(mask_br).rounded_rectangle([(3, 3), (74, 107)], radius=8, fill=255)
    mask_br = mask_br.filter(ImageFilter.GaussianBlur(radius=3.0))
    ace.paste(Image.fromarray(tiled_br), (638, 865), mask_br)
    
    # 3. Erase bottom gold text strictly before canvas blending
    erase_isolated_emblem(ace, (190, 755, 545, 925), is_red=is_red)
    
    # 4. Synthesize seamless canvas
    sw, sh = strip_patch.shape[1], strip_patch.shape[0]
    block_w, block_h = sw * 2, sh * 2
    block = np.zeros((block_h, block_w, 3), dtype=np.float32)
    block[:sh, :sw] = strip_patch
    block[:sh, sw:] = np.fliplr(strip_patch)
    block[sh:, :sw] = np.flipud(strip_patch)
    block[sh:, sw:] = np.flipud(np.fliplr(strip_patch))
    
    block_im = Image.fromarray(block.astype(np.uint8))
    canvas = Image.new('RGB', (cw, ch))
    for y in range(0, ch, block_h):
        for x in range(0, cw, block_w):
            canvas.paste(block_im, (x, y))
            
    # Normalize canvas mean to match background
    bg_sample = arr[350:650, 105:130] if not is_red else arr[350:650, 115:140]
    bg_mean = bg_sample.mean(axis=(0,1))
    can_arr = np.array(canvas, dtype=np.float32)
    can_arr = can_arr - can_arr.mean(axis=(0,1)) + bg_mean
    canvas_matched = Image.fromarray(np.clip(can_arr, 0, 255).astype(np.uint8))
            
    # Refined mask that preserves all corner badges and flourishes with feathered transition
    mask_c = Image.new('L', (cw, ch), 0)
    draw_c = ImageDraw.Draw(mask_c)
    draw_c.rectangle([(138, 130), (cw - 138, 240)], fill=255)
    draw_c.rectangle([(125, 240), (cw - 125, 760)], fill=255)
    draw_c.rectangle([(165, 760), (cw - 165, 845)], fill=255)
    draw_c.rectangle([(195, 845), (540, 920)], fill=255)
    mask_c = mask_c.filter(ImageFilter.GaussianBlur(radius=6.0))
    
    clean_base = Image.composite(canvas_matched, ace, mask_c)
    return clean_base

# 4. Generate Individual Pip Card (Ranks 2-10)
def generate_pip_card(rank, suit_dir, suit_single, base_card):
    card = base_card.copy()
    
    num = create_bespoke_gold_numeral(str(rank))
    nw, nh = num.size
    
    # Top-left index
    card.paste(num, (88 - nw//2, 80 - nh//2), num)
    
    # Bottom-right index
    num_inv = num.rotate(180)
    card.paste(num_inv, (677 - nw//2, 920 - nh//2), num_inv)
    
    pip_img = Image.open(f'{PIP_DIR}/pip_{suit_single}_pure.png').convert('RGBA')
    pw, ph = pip_img.size
    
    target_h = 145 if rank <= 3 else (130 if rank <= 6 else (120 if rank <= 8 else 110))
    target_w = int(pw * (target_h / float(ph)))
    pip_c = pip_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    pip_c_inv = pip_c.rotate(180)
    
    positions = get_positions(rank)
    for px, py, inv in positions:
        p = pip_c_inv if inv else pip_c
        card.paste(p, (px - target_w//2, py - target_h//2), p)
        
    final_rgb = Image.composite(card, WHITE_BG, MASK)
    card_trans = card.copy()
    card_trans.putalpha(MASK)
    
    jpg_path = os.path.join(DECK_DIR, f'{suit_dir}_{rank}.jpg')
    png_path = os.path.join(DECK_DIR, f'{suit_dir}_{rank}.png')
    
    final_rgb.save(jpg_path, quality=100, subsampling=0)
    card_trans.save(png_path)

# 5. Build Refined Court Cards (K, Q, J)
def build_court_cards():
    print("Step 3: Rendering pristine luxury Court cards (K, Q, J)...")
    pip_diamond = Image.open(f'{PIP_DIR}/pip_diamond_pure.png').convert('RGBA')
    pip_club = Image.open(f'{PIP_DIR}/pip_club_pure.png').convert('RGBA')

    # 5a. Diamonds Court Cards (K, Q, J) derived from pristine authentic Hearts
    for rank in ['K', 'Q', 'J']:
        src_path = os.path.join(DECK_DIR, f'hearts_{rank}.jpg')
        card = Image.open(src_path).convert('RGB')
        
        erase_isolated_emblem(card, (50, 132, 150, 242), is_red=True)
        erase_isolated_emblem(card, (150, 115, 300, 268), is_red=True)
        erase_isolated_emblem(card, (485, 740, 625, 895), is_red=True)
        erase_isolated_emblem(card, (635, 755, 724, 865), is_red=True)
        
        inner_w, inner_h = 126, 144
        pip_inner_tl = pip_diamond.resize((inner_w, inner_h), Image.Resampling.LANCZOS)
        pip_inner_br = pip_inner_tl.rotate(180)
        card.paste(pip_inner_tl, (220 - inner_w//2, 178 - inner_h//2), pip_inner_tl)
        card.paste(pip_inner_br, (557 - inner_w//2, 828 - inner_h//2), pip_inner_br)
        
        corner_w, corner_h = 68, 78
        pip_corner_tl = pip_diamond.resize((corner_w, corner_h), Image.Resampling.LANCZOS)
        pip_corner_br = pip_corner_tl.rotate(180)
        card.paste(pip_corner_tl, (95 - corner_w//2, 186 - corner_h//2), pip_corner_tl)
        card.paste(pip_corner_br, (680 - corner_w//2, 821 - corner_h//2), pip_corner_br)
        
        final_rgb = Image.composite(card, WHITE_BG, MASK)
        card_trans = card.copy()
        card_trans.putalpha(MASK)
        
        final_rgb.save(os.path.join(DECK_DIR, f'diamonds_{rank}.jpg'), quality=100, subsampling=0)
        card_trans.save(os.path.join(DECK_DIR, f'diamonds_{rank}.png'))
        print(f"  Pristine Court card generated: diamonds_{rank} (.jpg & .png)")

    # 5b. Clubs Court Cards (K, Q, J) derived from pristine authentic Spades
    for rank in ['K', 'Q', 'J']:
        src_path = os.path.join(DECK_DIR, f'spades_{rank}.jpg')
        card = Image.open(src_path).convert('RGB')
        
        erase_isolated_emblem(card, (50, 132, 150, 242), is_red=False)
        erase_isolated_emblem(card, (150, 115, 300, 268), is_red=False)
        erase_isolated_emblem(card, (485, 740, 625, 895), is_red=False)
        erase_isolated_emblem(card, (635, 755, 724, 865), is_red=False)
        
        inner_w, inner_h = 120, 142
        pip_inner_tl = pip_club.resize((inner_w, inner_h), Image.Resampling.LANCZOS)
        pip_inner_br = pip_inner_tl.rotate(180)
        card.paste(pip_inner_tl, (218 - inner_w//2, 195 - inner_h//2), pip_inner_tl)
        card.paste(pip_inner_br, (556 - inner_w//2, 815 - inner_h//2), pip_inner_br)
        
        corner_w, corner_h = 66, 78
        pip_corner_tl = pip_club.resize((corner_w, corner_h), Image.Resampling.LANCZOS)
        pip_corner_br = pip_corner_tl.rotate(180)
        card.paste(pip_corner_tl, (95 - corner_w//2, 195 - corner_h//2), pip_corner_tl)
        card.paste(pip_corner_br, (678 - corner_w//2, 810 - corner_h//2), pip_corner_br)
        
        final_rgb = Image.composite(card, WHITE_BG, MASK)
        card_trans = card.copy()
        card_trans.putalpha(MASK)
        
        final_rgb.save(os.path.join(DECK_DIR, f'clubs_{rank}.jpg'), quality=100, subsampling=0)
        card_trans.save(os.path.join(DECK_DIR, f'clubs_{rank}.png'))
        print(f"  Pristine Court card generated: clubs_{rank} (.jpg & .png)")

    # 5c. Ensure Spades and Hearts Court Cards have pure white corners & 4:4:4
    for suit in ['spades', 'hearts']:
        for rank in ['K', 'Q', 'J']:
            src_path = os.path.join(DECK_DIR, f'{suit}_{rank}.jpg')
            card = Image.open(src_path).convert('RGB')
            final_rgb = Image.composite(card, WHITE_BG, MASK)
            card_trans = card.copy()
            card_trans.putalpha(MASK)
            final_rgb.save(src_path, quality=100, subsampling=0)
            card_trans.save(os.path.join(DECK_DIR, f'{suit}_{rank}.png'))

# 6. Ensure Aces and Jokers are 100% 4:4:4 and Pure White
def build_aces_and_jokers():
    print("Step 4: Verifying Aces and Jokers (4:4:4 subsampling & pure white corners)...")
    for name in ['spades_A', 'hearts_A', 'clubs_A', 'diamonds_A', 'joker', 'natural_joker']:
        src_path = os.path.join(DECK_DIR, f'{name}.jpg')
        card = Image.open(src_path).convert('RGB')
        final_rgb = Image.composite(card, WHITE_BG, MASK)
        card_trans = card.copy()
        card_trans.putalpha(MASK)
        final_rgb.save(src_path, quality=100, subsampling=0)
        card_trans.save(os.path.join(DECK_DIR, f'{name}.png'))
        print(f"  Aces/Joker verified: {name} (.jpg & .png)")

def main():
    print("=== BUILDING ROYAL HERITAGE GOLD EDITION MASTER DECK (54 CARDS) ===")
    suits = [
        ('spades', 'spade'),
        ('hearts', 'heart'),
        ('clubs', 'club'),
        ('diamonds', 'diamond')
    ]
    
    # 1. Build pristine bases for pip cards
    print("Step 1: Generating pristine master bases...")
    bases = {}
    for suit_dir, suit_single in suits:
        bases[suit_dir] = build_master_base_pristine(suit_dir)
        bases[suit_dir].save(f'{PIP_DIR}/master_base_{suit_dir}.png')
        print(f"  Pristine master base ready: {suit_dir}")
        
    # 2. Build all 36 pip cards (ranks 2 through 10)
    print("Step 2: Rendering 36 luxury pip cards (ranks 2-10)...")
    for suit_dir, suit_single in suits:
        base = bases[suit_dir]
        for rank in range(2, 11):
            generate_pip_card(rank, suit_dir, suit_single, base)
            
    # 3. Build Court cards (12 cards)
    build_court_cards()
    
    # 4. Process Aces and Jokers (6 cards)
    build_aces_and_jokers()
    
    print("=== COMPLETE 54-CARD ROYAL HERITAGE MASTER DECK FULLY GENERATED ===")

if __name__ == '__main__':
    main()
