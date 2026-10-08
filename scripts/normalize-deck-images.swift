import AppKit
import Foundation

let brainDir = "/Users/Harsh/.gemini/antigravity/brain/f97ec65b-5994-4029-ae7d-08e5610a2bff"
let projectDir = "/Users/Harsh/Pukar game"
let cardsDir = "\(projectDir)/public/cards"

let targetSize = NSSize(width: 600.0, height: 900.0)

// Helper to create blank 600x900 RGBA bitmap representation with rounded card clipping
func createCardContext() -> (NSBitmapImageRep, CGContext)? {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(targetSize.width),
        pixelsHigh: Int(targetSize.height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { return nil }
    
    guard let ctx = NSGraphicsContext(bitmapImageRep: rep) else { return nil }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = ctx
    let cg = ctx.cgContext
    
    cg.clear(CGRect(origin: .zero, size: targetSize))
    let clip = CGPath(roundedRect: CGRect(origin: .zero, size: targetSize), cornerWidth: 36.0, cornerHeight: 36.0, transform: nil)
    cg.addPath(clip)
    cg.clip()
    
    return (rep, cg)
}

func savePNG(rep: NSBitmapImageRep, paths: [String]) {
    guard let data = rep.representation(using: .png, properties: [:]) else { return }
    for p in paths {
        try? data.write(to: URL(fileURLWithPath: p))
    }
}

// 1. Process Master Raster Cards
struct MasterCard {
    let filename: String
    let suit: String
    let rank: String
    let crop: CGRect
}

let masterCards: [MasterCard] = [
    // Spades
    MasterCard(filename: "ace_of_spades_1791415862078.jpg", suit: "Spades", rank: "A", crop: CGRect(x: 35.0, y: 50.0, width: 778.0, height: 1164.0)),
    MasterCard(filename: "king_of_spades_1791416033424.jpg", suit: "Spades", rank: "K", crop: CGRect(x: 70.0, y: 123.0, width: 741.0, height: 994.0)),
    MasterCard(filename: "queen_of_spades_1791415900811.jpg", suit: "Spades", rank: "Q", crop: CGRect(x: 71.0, y: 133.0, width: 705.0, height: 1001.0)),
    
    // Hearts
    MasterCard(filename: "ace_of_hearts_1791416072357.jpg", suit: "Hearts", rank: "A", crop: CGRect(x: 53.0, y: 62.0, width: 741.0, height: 1139.0)),
    MasterCard(filename: "king_of_hearts_1791415884390.jpg", suit: "Hearts", rank: "K", crop: CGRect(x: 69.0, y: 116.0, width: 709.0, height: 1030.0)),
    MasterCard(filename: "queen_of_hearts_1791416013748.jpg", suit: "Hearts", rank: "Q", crop: CGRect(x: 79.0, y: 122.0, width: 689.0, height: 1019.0)),
    MasterCard(filename: "ten_of_hearts_1791415958479.jpg", suit: "Hearts", rank: "10", crop: CGRect(x: 68.0, y: 95.0, width: 711.0, height: 1071.0)),
    
    // Diamonds
    MasterCard(filename: "ace_of_diamonds_1791416092435.jpg", suit: "Diamonds", rank: "A", crop: CGRect(x: 92.0, y: 95.0, width: 663.0, height: 1023.0)),
    MasterCard(filename: "king_of_diamonds_1791416116137.jpg", suit: "Diamonds", rank: "K", crop: CGRect(x: 77.0, y: 125.0, width: 692.0, height: 1016.0)),
    MasterCard(filename: "jack_of_diamonds_1791416052550.jpg", suit: "Diamonds", rank: "J", crop: CGRect(x: 66.0, y: 94.0, width: 694.0, height: 1000.0)),
    
    // Clubs
    MasterCard(filename: "ace_of_clubs_1791415993900.jpg", suit: "Clubs", rank: "A", crop: CGRect(x: 40.0, y: 61.0, width: 767.0, height: 1130.0)),
    MasterCard(filename: "jack_of_clubs_1791415919659.jpg", suit: "Clubs", rank: "J", crop: CGRect(x: 78.0, y: 110.0, width: 692.0, height: 1044.0)),
]

print("Normalizing authentic master raster cards...")
for card in masterCards {
    let srcPath = "\(brainDir)/\(card.filename)"
    guard let img = NSImage(contentsOfFile: srcPath),
          let (rep, _) = createCardContext() else {
        print("Error loading \(srcPath)")
        continue
    }
    
    let srcH = img.size.height
    let srcRect = NSRect(x: card.crop.origin.x, y: srcH - card.crop.origin.y - card.crop.height, width: card.crop.width, height: card.crop.height)
    img.draw(in: NSRect(origin: .zero, size: targetSize), from: srcRect, operation: .copy, fraction: 1.0)
    NSGraphicsContext.restoreGraphicsState()
    
    let suitLower = card.suit.lowercased()
    let outPaths = [
        "\(cardsDir)/\(card.suit)/\(card.rank).png",
        "\(cardsDir)/\(card.suit)/\(suitLower)_\(card.rank).png",
        "\(cardsDir)/\(suitLower)_\(card.rank).png"
    ]
    savePNG(rep: rep, paths: outPaths)
    print("  Normalized: \(card.suit) \(card.rank)")
}

// Process Joker
if let jokerImg = NSImage(contentsOfFile: "\(brainDir)/natural_joker_1791415938846.jpg"),
   let (jokerRep, _) = createCardContext() {
    let srcH = jokerImg.size.height
    let cropRect = NSRect(x: 40.0, y: srcH - 55.0 - 1152.0, width: 768.0, height: 1152.0)
    jokerImg.draw(in: NSRect(origin: .zero, size: targetSize), from: cropRect, operation: .copy, fraction: 1.0)
    NSGraphicsContext.restoreGraphicsState()
    
    let outPaths = [
        "\(cardsDir)/joker.png",
        "\(cardsDir)/natural_joker.png"
    ]
    savePNG(rep: jokerRep, paths: outPaths)
    print("  Normalized: Natural Joker")
}

// 2. Synthesize Missing Court Cards
func makePipSvg(suit: String, size: Int = 100) -> NSImage? {
    let svg: String
    if suit == "Clubs" {
        svg = """
        <svg xmlns="http://www.w3.org/2000/svg" width="\(size)" height="\(size)" viewBox="-50 -50 100 100">
          <circle cx="0" cy="-20" r="22" fill="#1A2438" stroke="#101824" stroke-width="4.5"/>
          <circle cx="-20" cy="12" r="22" fill="#1A2438" stroke="#101824" stroke-width="4.5"/>
          <circle cx="20" cy="12" r="22" fill="#1A2438" stroke="#101824" stroke-width="4.5"/>
          <circle cx="0" cy="0" r="16" fill="#1A2438"/>
          <path d="M -8,12 Q -8,42 -18,48 L 18,48 Q 8,42 8,12 Z" fill="#1A2438" stroke="#101824" stroke-width="3.5"/>
          <path d="M 0,-34 Q -8,-20 0,-8 Q 8,-20 0,-34 Z" fill="#2E7E7A"/>
          <path d="M -26,8 Q -16,2 -10,14 Q -20,20 -26,8 Z" fill="#D6A449"/>
          <path d="M 26,8 Q 16,2 10,14 Q 20,20 26,8 Z" fill="#D6A449"/>
          <circle cx="0" cy="0" r="3.5" fill="#F4C458"/>
        </svg>
        """
    } else if suit == "Spades" {
        svg = """
        <svg xmlns="http://www.w3.org/2000/svg" width="\(size)" height="\(size)" viewBox="-50 -50 100 100">
          <path d="M 0,-48 C -22,-20 -44,6 -44,22 C -44,38 -28,44 -14,40 C -4,37 0,26 0,26 C 0,26 4,37 14,40 C 28,44 44,38 44,22 C 44,6 22,-20 0,-48 Z" fill="#1A2438" stroke="#101824" stroke-width="4"/>
          <path d="M -8,28 Q -8,46 -20,52 L 20,52 Q 8,46 8,28 Z" fill="#1A2438" stroke="#101824" stroke-width="3"/>
          <path d="M 0,-34 Q -10,-10 -6,16 Q 0,8 0,-34 Z" fill="#2E7E7A"/>
          <path d="M 0,-34 Q 10,-10 6,16 Q 0,8 0,-34 Z" fill="#2E7E7A"/>
          <path d="M -16,4 Q -28,18 -18,28 Q -8,22 -16,4 Z" fill="#D6A449"/>
          <path d="M 16,4 Q 28,18 18,28 Q 8,22 16,4 Z" fill="#D6A449"/>
          <circle cx="0" cy="2" r="3" fill="#F4C458"/>
        </svg>
        """
    } else if suit == "Hearts" {
        svg = """
        <svg xmlns="http://www.w3.org/2000/svg" width="\(size)" height="\(size)" viewBox="-50 -50 100 100">
          <path d="M 0,44 C -4,40 -42,12 -42,-14 C -42,-34 -24,-46 0,-26 C 24,-46 42,-34 42,-14 C 42,12 4,40 0,44 Z" fill="#D03D32" stroke="#1C1414" stroke-width="4"/>
          <path d="M 0,-18 C -12,-30 -26,-14 -16,6 C -8,2 -4,-6 0,-18 Z" fill="#EE7D68"/>
          <path d="M 0,-18 C 12,-30 26,-14 16,6 C 8,2 4,-6 0,-18 Z" fill="#EE7D68"/>
          <path d="M 0,-6 Q -8,14 0,30 Q 8,14 0,-6 Z" fill="#F4C458"/>
          <circle cx="0" cy="-6" r="3.5" fill="#FAF5E8"/>
          <circle cx="-16" cy="-14" r="2.5" fill="#2E7E7A"/>
          <circle cx="16" cy="-14" r="2.5" fill="#2E7E7A"/>
        </svg>
        """
    } else { // Diamonds
        svg = """
        <svg xmlns="http://www.w3.org/2000/svg" width="\(size)" height="\(size)" viewBox="-50 -50 100 100">
          <path d="M 0,-48 L 38,0 L 0,48 L -38,0 Z" fill="#D03D32" stroke="#1C1414" stroke-width="4"/>
          <path d="M 0,-34 L 24,0 L 0,34 L -24,0 Z" fill="#EE7D68"/>
          <path d="M 0,-20 L 14,0 L 0,20 L -14,0 Z" fill="#F4C458"/>
          <circle cx="0" cy="0" r="3.5" fill="#FAF5E8"/>
          <circle cx="0" cy="-34" r="2.5" fill="#2E7E7A"/>
          <circle cx="0" cy="34" r="2.5" fill="#2E7E7A"/>
        </svg>
        """
    }
    guard let data = svg.data(using: .utf8) else { return nil }
    return NSImage(data: data)
}

print("Synthesizing missing court cards seamlessly with exact pip centers...")

func applyCornerPips(cg: CGContext, pip: NSImage, bgColor: NSColor, cX: Double, yCG: Double) {
    cg.setFillColor(bgColor.cgColor)
    // Top-left
    cg.fillEllipse(in: CGRect(x: cX - 35.0, y: yCG - 44.0, width: 70.0, height: 88.0))
    pip.draw(in: NSRect(x: cX - 30.0, y: yCG - 30.0, width: 60.0, height: 60.0))
    
    // Bottom-right
    let brX = 600.0 - cX
    let brY = 900.0 - yCG
    cg.fillEllipse(in: CGRect(x: brX - 35.0, y: brY - 44.0, width: 70.0, height: 88.0))
    cg.saveGState()
    cg.translateBy(x: brX, y: brY)
    cg.rotate(by: .pi)
    cg.translateBy(x: -brX, y: -brY)
    pip.draw(in: NSRect(x: brX - 30.0, y: brY - 30.0, width: 60.0, height: 60.0))
    cg.restoreGState()
}

// 1. King of Clubs (synthesized from King of Spades)
if let kingSpades = NSImage(contentsOfFile: "\(brainDir)/king_of_spades_1791416033424.jpg"),
   let (rep, cg) = createCardContext(),
   let clubPip = makePipSvg(suit: "Clubs") {
    let srcH = kingSpades.size.height
    let cropSrc = NSRect(x: 70.0, y: srcH - 123.0 - 994.0, width: 741.0, height: 994.0)
    kingSpades.draw(in: NSRect(origin: .zero, size: targetSize), from: cropSrc, operation: .copy, fraction: 1.0)
    
    let bg = NSColor(red: 247.0/255.0, green: 244.0/255.0, blue: 236.0/255.0, alpha: 1.0)
    applyCornerPips(cg: cg, pip: clubPip, bgColor: bg, cX: 65.2, yCG: 707.1)
    
    // Scepter setting
    cg.setFillColor(NSColor(red: 214.0/255.0, green: 164.0/255.0, blue: 73.0/255.0, alpha: 1.0).cgColor)
    cg.setStrokeColor(NSColor(red: 26.0/255.0, green: 20.0/255.0, blue: 20.0/255.0, alpha: 1.0).cgColor)
    cg.setLineWidth(3.5)
    let scepterOuter = CGRect(x: 124.0, y: 538.0, width: 80.0, height: 90.0)
    cg.addPath(CGPath(roundedRect: scepterOuter, cornerWidth: 32.0, cornerHeight: 32.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    cg.setFillColor(NSColor(red: 30.0/255.0, green: 90.0/255.0, blue: 85.0/255.0, alpha: 1.0).cgColor)
    let scepterInner = CGRect(x: 130.0, y: 544.0, width: 68.0, height: 78.0)
    cg.addPath(CGPath(roundedRect: scepterInner, cornerWidth: 26.0, cornerHeight: 26.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    clubPip.draw(in: NSRect(x: 136.0, y: 555.0, width: 56.0, height: 56.0))
    NSGraphicsContext.restoreGraphicsState()
    
    savePNG(rep: rep, paths: ["\(cardsDir)/Clubs/K.png", "\(cardsDir)/Clubs/clubs_K.png", "\(cardsDir)/clubs_K.png"])
    print("  Synthesized: Clubs K")
}

// 2. Queen of Clubs (synthesized from Queen of Spades)
if let queenSpades = NSImage(contentsOfFile: "\(brainDir)/queen_of_spades_1791415900811.jpg"),
   let (rep, cg) = createCardContext(),
   let clubPip = makePipSvg(suit: "Clubs") {
    let srcH = queenSpades.size.height
    let cropSrc = NSRect(x: 71.0, y: srcH - 133.0 - 1001.0, width: 705.0, height: 1001.0)
    queenSpades.draw(in: NSRect(origin: .zero, size: targetSize), from: cropSrc, operation: .copy, fraction: 1.0)
    
    let bg = NSColor(red: 248.0/255.0, green: 245.0/255.0, blue: 238.0/255.0, alpha: 1.0)
    applyCornerPips(cg: cg, pip: clubPip, bgColor: bg, cX: 69.4, yCG: 722.9)
    
    // Wand setting
    cg.setFillColor(NSColor(red: 214.0/255.0, green: 164.0/255.0, blue: 73.0/255.0, alpha: 1.0).cgColor)
    cg.setStrokeColor(NSColor(red: 26.0/255.0, green: 20.0/255.0, blue: 20.0/255.0, alpha: 1.0).cgColor)
    cg.setLineWidth(3.5)
    let wandOuter = CGRect(x: 102.0, y: 546.0, width: 78.0, height: 88.0)
    cg.addPath(CGPath(roundedRect: wandOuter, cornerWidth: 30.0, cornerHeight: 30.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    cg.setFillColor(NSColor(red: 30.0/255.0, green: 90.0/255.0, blue: 85.0/255.0, alpha: 1.0).cgColor)
    let wandInner = CGRect(x: 108.0, y: 552.0, width: 66.0, height: 76.0)
    cg.addPath(CGPath(roundedRect: wandInner, cornerWidth: 24.0, cornerHeight: 24.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    clubPip.draw(in: NSRect(x: 113.0, y: 562.0, width: 56.0, height: 56.0))
    NSGraphicsContext.restoreGraphicsState()
    
    savePNG(rep: rep, paths: ["\(cardsDir)/Clubs/Q.png", "\(cardsDir)/Clubs/clubs_Q.png", "\(cardsDir)/clubs_Q.png"])
    print("  Synthesized: Clubs Q")
}

// 3. Queen of Diamonds (synthesized from Queen of Hearts)
if let queenHearts = NSImage(contentsOfFile: "\(brainDir)/queen_of_hearts_1791416013748.jpg"),
   let (rep, cg) = createCardContext(),
   let diamondPip = makePipSvg(suit: "Diamonds") {
    let srcH = queenHearts.size.height
    let cropSrc = NSRect(x: 79.0, y: srcH - 122.0 - 1019.0, width: 689.0, height: 1019.0)
    queenHearts.draw(in: NSRect(origin: .zero, size: targetSize), from: cropSrc, operation: .copy, fraction: 1.0)
    
    let bg = NSColor.white
    applyCornerPips(cg: cg, pip: diamondPip, bgColor: bg, cX: 89.7, yCG: 714.1)
    
    // Wand setting
    cg.setFillColor(NSColor(red: 214.0/255.0, green: 164.0/255.0, blue: 73.0/255.0, alpha: 1.0).cgColor)
    cg.setStrokeColor(NSColor(red: 26.0/255.0, green: 20.0/255.0, blue: 20.0/255.0, alpha: 1.0).cgColor)
    cg.setLineWidth(3.5)
    let wandOuter = CGRect(x: 128.0, y: 546.0, width: 78.0, height: 88.0)
    cg.addPath(CGPath(roundedRect: wandOuter, cornerWidth: 30.0, cornerHeight: 30.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    cg.setFillColor(NSColor(red: 190.0/255.0, green: 40.0/255.0, blue: 35.0/255.0, alpha: 1.0).cgColor)
    let wandInner = CGRect(x: 134.0, y: 552.0, width: 66.0, height: 76.0)
    cg.addPath(CGPath(roundedRect: wandInner, cornerWidth: 24.0, cornerHeight: 24.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    diamondPip.draw(in: NSRect(x: 139.0, y: 562.0, width: 56.0, height: 56.0))
    NSGraphicsContext.restoreGraphicsState()
    
    savePNG(rep: rep, paths: ["\(cardsDir)/Diamonds/Q.png", "\(cardsDir)/Diamonds/diamonds_Q.png", "\(cardsDir)/diamonds_Q.png"])
    print("  Synthesized: Diamonds Q")
}

// 4. Jack of Spades (synthesized from Jack of Clubs)
if let jackClubs = NSImage(contentsOfFile: "\(brainDir)/jack_of_clubs_1791415919659.jpg"),
   let (rep, cg) = createCardContext(),
   let spadePip = makePipSvg(suit: "Spades") {
    let srcH = jackClubs.size.height
    let cropSrc = NSRect(x: 78.0, y: srcH - 110.0 - 1044.0, width: 692.0, height: 1044.0)
    jackClubs.draw(in: NSRect(origin: .zero, size: targetSize), from: cropSrc, operation: .copy, fraction: 1.0)
    
    let bg = NSColor(red: 248.0/255.0, green: 245.0/255.0, blue: 238.0/255.0, alpha: 1.0)
    applyCornerPips(cg: cg, pip: spadePip, bgColor: bg, cX: 66.3, yCG: 710.3)
    
    // Staff setting
    cg.setFillColor(NSColor(red: 214.0/255.0, green: 164.0/255.0, blue: 73.0/255.0, alpha: 1.0).cgColor)
    cg.setStrokeColor(NSColor(red: 26.0/255.0, green: 20.0/255.0, blue: 20.0/255.0, alpha: 1.0).cgColor)
    cg.setLineWidth(3.5)
    let staffOuter = CGRect(x: 120.0, y: 550.0, width: 80.0, height: 90.0)
    cg.addPath(CGPath(roundedRect: staffOuter, cornerWidth: 30.0, cornerHeight: 30.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    cg.setFillColor(NSColor(red: 26.0/255.0, green: 36.0/255.0, blue: 56.0/255.0, alpha: 1.0).cgColor)
    let staffInner = CGRect(x: 126.0, y: 556.0, width: 68.0, height: 78.0)
    cg.addPath(CGPath(roundedRect: staffInner, cornerWidth: 24.0, cornerHeight: 24.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    spadePip.draw(in: NSRect(x: 132.0, y: 567.0, width: 56.0, height: 56.0))
    NSGraphicsContext.restoreGraphicsState()
    
    savePNG(rep: rep, paths: ["\(cardsDir)/Spades/J.png", "\(cardsDir)/Spades/spades_J.png", "\(cardsDir)/spades_J.png"])
    print("  Synthesized: Spades J")
}

// 5. Jack of Hearts (synthesized from Jack of Diamonds)
if let jackDiamonds = NSImage(contentsOfFile: "\(brainDir)/jack_of_diamonds_1791416052550.jpg"),
   let (rep, cg) = createCardContext(),
   let heartPip = makePipSvg(suit: "Hearts") {
    let srcH = jackDiamonds.size.height
    let cropSrc = NSRect(x: 66.0, y: srcH - 94.0 - 1000.0, width: 694.0, height: 1000.0)
    jackDiamonds.draw(in: NSRect(origin: .zero, size: targetSize), from: cropSrc, operation: .copy, fraction: 1.0)
    
    let bg = NSColor(red: 250.0/255.0, green: 246.0/255.0, blue: 238.0/255.0, alpha: 1.0)
    applyCornerPips(cg: cg, pip: heartPip, bgColor: bg, cX: 97.3, yCG: 697.0)
    
    // Staff setting
    cg.setFillColor(NSColor(red: 214.0/255.0, green: 164.0/255.0, blue: 73.0/255.0, alpha: 1.0).cgColor)
    cg.setStrokeColor(NSColor(red: 26.0/255.0, green: 20.0/255.0, blue: 20.0/255.0, alpha: 1.0).cgColor)
    cg.setLineWidth(3.5)
    let staffOuter = CGRect(x: 118.0, y: 548.0, width: 80.0, height: 90.0)
    cg.addPath(CGPath(roundedRect: staffOuter, cornerWidth: 30.0, cornerHeight: 30.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    cg.setFillColor(NSColor(red: 190.0/255.0, green: 40.0/255.0, blue: 35.0/255.0, alpha: 1.0).cgColor)
    let staffInner = CGRect(x: 124.0, y: 554.0, width: 68.0, height: 78.0)
    cg.addPath(CGPath(roundedRect: staffInner, cornerWidth: 24.0, cornerHeight: 24.0, transform: nil))
    cg.drawPath(using: .fillStroke)
    
    heartPip.draw(in: NSRect(x: 130.0, y: 565.0, width: 56.0, height: 56.0))
    NSGraphicsContext.restoreGraphicsState()
    
    savePNG(rep: rep, paths: ["\(cardsDir)/Hearts/J.png", "\(cardsDir)/Hearts/hearts_J.png", "\(cardsDir)/hearts_J.png"])
    print("  Synthesized: Hearts J")
}

// 3. Render all 35 Number Cards (2..10) from SVGs
print("Rendering number card SVGs into crisp 600x900 PNGs...")
let suits = ["Spades", "Hearts", "Diamonds", "Clubs"]
let ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10]

for suit in suits {
    let suitLower = suit.lowercased()
    for rank in ranks {
        // Skip Hearts 10 because we already have the authentic master raster card!
        if suit == "Hearts" && rank == 10 { continue }
        
        let svgPath = "\(cardsDir)/\(suit)/\(rank).svg"
        guard let svgImg = NSImage(contentsOfFile: svgPath),
              let (rep, _) = createCardContext() else {
            print("Failed to load \(svgPath)")
            continue
        }
        
        svgImg.draw(in: NSRect(origin: .zero, size: targetSize))
        NSGraphicsContext.restoreGraphicsState()
        
        let outPaths = [
            "\(cardsDir)/\(suit)/\(rank).png",
            "\(cardsDir)/\(suit)/\(suitLower)_\(rank).png",
            "\(cardsDir)/\(suitLower)_\(rank).png"
        ]
        savePNG(rep: rep, paths: outPaths)
    }
    print("  Rendered all number PNGs for \(suit)")
}

print("All card processing and rendering complete!")
