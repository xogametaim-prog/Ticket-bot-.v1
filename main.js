import readline from 'readline';

// إعداد مدخلات ومخرجات الـ Terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const COLORS = ['Red', 'Green', 'Blue', 'Yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'Draw2'];

class UnoGame {
    constructor() {
        this.deck = [];
        this.playerHand = [];
        this.botHand = [];
        this.discardPile = [];
        this.createDeck();
        this.shuffleDeck();
        this.dealCards();
    }

    // إنشاء كروت الأونو العشوائية والمختلفة لكل جيم
    createDeck() {
        this.deck = [];
        for (let color of COLORS) {
            for (let value of VALUES) {
                this.deck.push({ color, value });
                if (value !== '0') this.deck.push({ color, value }); // كرت مكرر كالأونو الحقيقية
            }
        }
    }

    // خلط الكروت عشوائياً
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // توزيع 7 كروت مختلفة لكل لاعب في بداية الجولة
    dealCards() {
        for (let i = 0; i < 7; i++) {
            this.playerHand.push(this.deck.pop());
            this.botHand.push(this.deck.pop());
        }
        // وضع أول كرت على الطاولة لبدء اللعب
        this.discardPile.push(this.deck.pop());
    }

    get topCard() {
        return this.discardPile[this.discardPile.length - 1];
    }

    // التحقق هل الكرت المسحوب يمكن لعبه أم لا
    isValidMove(card) {
        return card.color === this.topCard.color || card.value === this.topCard.value;
    }

    // عرض كروت اللاعب الحالي
    displayStatus() {
        console.log('\n======================================');
        console.log(`🔴 الكرت الذي على الطاولة الآن: [ ${this.topCard.color} ${this.topCard.value} ]`);
        console.log('--------------------------------------');
        console.log(`🤖 كروت البوت المتبقية: ( ${this.botHand.length} كروت )`);
        console.log('🃏 كروتك الحالية في يدك:');
        this.playerHand.forEach((card, index) => {
            console.log(`   [${index + 1}] ${card.color} ${card.value}`);
        });
        console.log('======================================');
    }

    // دور اللاعب (أنت)
    playerTurn() {
        this.displayStatus();
        rl.question('اكتب اسم الكرت لتلعبه (مثال Red 5) أو اكتب draw للسحب: ', (input) => {
            const trimmedInput = input.trim();

            if (trimmedInput.toLowerCase() === 'draw') {
                const drawnCard = this.deck.pop();
                this.playerHand.push(drawnCard);
                console.log(`\n📥 سحبت كرت جديد: [ ${drawnCard.color} ${drawnCard.value} ]`);
                
                // إذا كان الكرت المسحوب مناسباً، يلعب فوراً
                if (this.isValidMove(drawnCard)) {
                    this.discardPile.push(this.playerHand.pop());
                    console.log(`✨ لعبت الكرت المسحوب فوراً!`);
                }
                this.checkGameStatus() ? this.endGame() : this.botTurn();
                return;
            }

            // البحث عن الكرت في يد اللاعب بناءً على ما كتبه
            const cardIndex = this.playerHand.findIndex(card => 
                `${card.color} ${card.value}`.toLowerCase() === trimmedInput.toLowerCase()
            );

            if (cardIndex !== -1) {
                const selectedCard = this.playerHand[cardIndex];
                if (this.isValidMove(selectedCard)) {
                    this.discardPile.push(this.playerHand.splice(cardIndex, 1)[0]);
                    console.log(`\n✅ لعبت بنجاح: [ ${selectedCard.color} ${selectedCard.value} ]`);
                    
                    if (this.checkGameStatus()) {
                        this.endGame();
                        return;
                    }
                    this.botTurn();
                } else {
                    console.log('\n❌ هذا الكرت لا يطابق اللون أو الرقم الحالي! حاول مجدداً.');
                    this.playerTurn();
                }
            } else {
                console.log('\n❌ لم نجد هذا الكرت في يدك! تأكد من كتابة الاسم صحيحاً (مثال: Blue 7).');
                this.playerTurn();
            }
        });
    }

    // دور البوت (الذكاء الاصطناعي)
    botTurn() {
        console.log('\n🤖 تفكير البوت...');
        setTimeout(() => {
            // البحث عن أول كرت مناسب في يد البوت ليصفّه على الطاولة
            const validCardIndex = this.botHand.findIndex(card => this.isValidMove(card));

            if (validCardIndex !== -1) {
                const botCard = this.botHand.splice(validCardIndex, 1)[0];
                this.discardPile.push(botCard);
                console.log(`🤖 البوت لعب كرت: [ ${botCard.color} ${botCard.value} ]`);
            } else {
                // إذا لم يجد كرت، يسحب كرت
                const drawnCard = this.deck.pop();
                this.botHand.push(drawnCard);
                console.log(`🤖 البوت لم يجد كرت، وقام بسحب كرت من السلة!`);
            }

            if (this.checkGameStatus()) {
                this.endGame();
            } else {
                this.playerTurn();
            }
        }, 1500); // تأخير ثانية ونصف لجعل اللعب واقعي
    }

    // التحقق من الفائز
    checkGameStatus() {
        if (this.playerHand.length === 0) {
            this.winner = 'Player';
            return true;
        }
        if (this.botHand.length === 0) {
            this.winner = 'Bot';
            return true;
        }
        // إعادة ملء السلة إذا انتهت الكروت
        if (this.deck.length === 0) {
            const top = this.discardPile.pop();
            this.deck = [...this.discardPile];
            this.shuffleDeck();
            this.discardPile = [top];
        }
        return false;
    }

    endGame() {
        console.log('\n🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆');
        if (this.winner === 'Player') {
            console.log('🎉 مبروك! لقد فزت وهزمت البوت بنجاح! 🎉');
        } else {
            console.log('😢 للأسف فاز البوت هذه المرة، حظاً أوفر الجولة القادمة! 🤖');
        }
        console.log('🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆\n');
        rl.close();
    }
}

// بدء اللعبة فوراً عند التشغيل
console.log('🔥 أهلاً بك في لعبة أونو المدمرة! 🔥');
const game = new UnoGame();
game.playerTurn();
