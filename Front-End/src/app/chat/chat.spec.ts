import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatComponent } from './chat.component';
import { By } from '@angular/platform-browser';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatComponent] // since it's standalone
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the ChatComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should render the chat page heading', () => {
    const headingElement = fixture.debugElement.query(By.css('h2')).nativeElement;
    expect(headingElement.textContent).toContain('Chat Page');
  });
});
