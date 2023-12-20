
import pdfplumber
import re
import sys
import json
import os

def get_token_count(text):
    tokens = text.split()
    return len(tokens)

def remove_home_header(text):
    header_start = 'Home >'
    # Find the start index of 'Home >'
    start_index = text.find(header_start)
    
    # If 'Home >' is not found, return the original text
    if start_index == -1:
        return text

    # Find the index of the newline character after 'Home >'
    end_index = text.find('\n', start_index)
    
    # If newline is found, remove the header, otherwise return text without 'Home >'
    if end_index != -1:
        # Remove the header by returning the text from after the newline character
        return text[end_index + 1:]
    else:
        # 'Home >' is found but no newline after it, return text without 'Home >'
        return text[start_index + len(header_start):]
    
def extract_header(text, header_start="Home >"):
    # Find the index where "Home >" starts
    start_index = text.find(header_start)
    if start_index != -1:
        # Find the index of the first newline character after "Home >"
        end_index = text.find('\n', start_index)
        # If a newline character is found after "Home >"
        if end_index != -1:
            # Extract the header up to the newline character
            return text[start_index:end_index].strip()
        else:
            # If there's no newline, return the text starting from "Home >"
            return text[start_index:].strip()
    return None  # Return None if "Home >" is not found

def clean_text(text):
    index_last_checked = 0
    while True:
        index_gt = text.find('>', index_last_checked)
        if index_gt == -1:
            break  # No more '>' found, exit loop
        
        # Find the next space after '>'
        index_space = text.find(' ', index_gt)
        if index_space == -1:
            break  # No more spaces found after the last '>', exit loop
        
        # Delete the space
        text = text[:index_space] + text[index_space+1:]
        
        # Update the index_last_checked to the position after the current '>'
        index_last_checked = index_gt + 1
    
    return text

def combine_multiline_header(header):
    # Split the header by newline to get individual lines
    lines = header.split('\n')
    
    combined = []
    buffer = ""
    for line in lines:
        # If buffer has PageContent and current line doesn't start with 'Home'
        if buffer and not line.startswith("Home"):
            buffer += " " + line.strip()  # .strip() to remove any leading/trailing whitespace
        else:
            if buffer:
                combined.append(buffer)
                buffer = ""
            buffer = line.strip()
    # Add any remaining PageContent in the buffer
    if buffer:
        combined.append(buffer)
    
    # Combine the processed lines back into a single string and replace '>' with '| '
    return '\n'.join(combined).replace('>', '| ')


def is_bold(char):
    return "Bold" in char.get("fontname", "")

def wrap_large_bold_sentences(text, chars):
    bold_sentences = []
    temp_sentence = ''
    inside_bold_sentence = False
    prev_y0 = chars[0]["y0"] if chars else None

    for idx, char in enumerate(chars):
        if inside_bold_sentence and abs(char["y0"] - prev_y0) > 10:
            temp_sentence += '\n'
        if is_bold(char) and char["size"] > 24:
            inside_bold_sentence = True
            temp_sentence += char["text"]
        else:
            if inside_bold_sentence:
                # Check if the bold sentence is standalone (either followed by a newline or it's the end of the text)
                if char["text"] == '\n':
                    # If next character is also bold and has a large font size, continue appending
                    if idx+1 < len(chars) and is_bold(chars[idx+1]) and chars[idx+1]["size"] > 24:
                        continue
                    else:
                        bold_sentences.append(temp_sentence)
                        temp_sentence = ''
                        inside_bold_sentence = False
                else:
                    break
        prev_y0 = char["y0"]

    # If there's a remaining bold sentence, add it
    if temp_sentence:
        bold_sentences.append(temp_sentence)

    # Wrap bold sentences with ^^ 
    for sentence in bold_sentences:
        # Skip sentences that start with *
        if text.startswith('*'):
            continue

        add_newline = False
        # Check if sentence ends with a newline
        if sentence.endswith('\n'):
            sentence = sentence.rstrip('\n')
            add_newline = True

        text = text.replace(sentence, f"**{sentence}**", 1)  # Only replace the first occurrence

        if add_newline:
            # Add back the newline after the ^^
            text = text.replace(f"^^{sentence}^^", f"^^{sentence}^^\n", 1)

    return text

def wrap_bold_text(text, chars, folder_name):
    # Extract bold text segments
    size_thresholds = {
    'SolidCAM Milling': {'large': 13, 'small': 8},
    'SolidCAM GPPTool': {'large': 16, 'small': 10},
    'SolidCAM Turning': {'large': 16, 'small': 10},
    'SolidCAM Wire': {'large': 16, 'small': 10},
    }
    default_thresholds = {'large': 16, 'small': 10}

    # Get custom thresholds for the file, or use defaults
    thresholds = size_thresholds.get(folder_name, default_thresholds)
    bold_text_segments = []
    inside_bold_segment = False
    temp_bold_string = ''
    prev_doctop = None
    prev_char_was_bold = False
    char_size = None

    def add_segment():
        nonlocal temp_bold_string, inside_bold_segment, char_size
        # Trim the segment to remove extra spaces
        trimmed_segment = temp_bold_string.strip()
        if trimmed_segment:
            bold_text_segments.append((trimmed_segment, prev_char_was_bold, char_size))
            temp_bold_string = ''
            inside_bold_segment = False

    for char in chars:
        # Check for new line based on doctop value
        new_line_detected = prev_doctop and abs(char["doctop"] - prev_doctop) > 10

        if is_bold(char):
            if not inside_bold_segment or new_line_detected or (char_size and char.get("size", 0) != char_size):
                add_segment()  # Close current segment and start a new one if there's a size change or new line
                inside_bold_segment = True
                char_size = char.get("size", 0)
            temp_bold_string += char["text"]
        else:
            add_segment()

        prev_doctop = char["doctop"]
        prev_char_was_bold = is_bold(char)

    add_segment()  # Add any remaining segment

    def wrap_segment(segment, size):
        if size >= thresholds['large']:
            return "****" + segment + "****"
        elif size > thresholds['small']:
            return "**" + segment + "**"
        else:
            return segment

    # Calculate start and end positions for each segment in the original text
    segments_with_positions = []
    for segment, prev_was_bold, size in bold_text_segments:
        start_pos = text.find(segment)
        end_pos = start_pos + len(segment)
        segments_with_positions.append((segment, start_pos, end_pos, size))

    # Sort segments by their start positions
    segments_with_positions.sort(key=lambda x: x[1])

    # Apply markdown, ensuring no overlaps
    for i, (segment, start, end, size) in enumerate(segments_with_positions):
        if segment != "Related Topics":
            wrapped_segment = wrap_segment(segment, size)
            # Check for overlapping with previous segments
            if i > 0 and start < segments_with_positions[i-1][2]:
                continue  # Skip segment if it overlaps
            text = text.replace(segment, wrapped_segment, 1)

    return text



def find_pages_starting_with(pdf_path, start_string):
    pages_content = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text and start_string in text:
                # Extract and clean the header
                header_extracted = extract_header(text)
                header = clean_text(header_extracted)
                header = combine_multiline_header(header)

                header_end_index = text.find(header_extracted) + len(header_extracted)
                page_content = text[header_end_index:].strip()
                chars = page.chars
                folder_name = os.path.basename(os.path.dirname(pdf_path))
                wrapped_text = wrap_bold_text(text, chars, folder_name)
                wrapped_text = wrap_large_bold_sentences(wrapped_text, chars)
                page_content = remove_home_header(wrapped_text)

                pages_content.append({
                    'page_number': page.page_number,
                    'header': header,
                    'pageContent': page_content
                })
                
            else:
                chars = page.chars
                folder_name = os.path.basename(os.path.dirname(pdf_path))
                wrapped_text = wrap_bold_text(text, chars, folder_name)
                wrapped_text = wrap_large_bold_sentences(wrapped_text, chars)
                page_content = remove_home_header(wrapped_text)
                pages_content.append({
                    'page_number': page.page_number,
                    'header': header,
                    'pageContent': page_content
                })
    return pages_content



#Removing Ralted Topics with hooks and link, avoiding removal of edge cases.


def has_special_character_in_last_three_lines(lines, current_index):
    """Check if there's a special character in the concatenated last three lines."""
    concatenated = ''.join(lines[current_index-3:current_index])
    
    # Check for a dash between uppercase letters
    if re.search(r'[A-Z]-[A-Z]', concatenated):
        return False

    # Check if the concatenated string starts with a pattern like "1." or "2."
    if re.match(r'^\d+\.', concatenated):
        return False
    
    special_characters = [':', '°']
    for char in special_characters:
        if char in concatenated:
            return True
            
    return False

def remove_related_topics_block(text):
    lines = text.split('\n')
    
    try:
        # Find the indices of the first and last occurrence of "Related Topics"
        start_index = lines.index("Related Topics")
        end_index = len(lines) - 1 - lines[::-1].index("Related Topics")

        # Remove the block between these indices, inclusive
        del lines[start_index:end_index + 1]
    except ValueError:
        # "Related Topics" not found, do nothing
        pass

    return '\n'.join(lines)



def append_related_topics(text):
    lines = text.split('\n')
    special_chars = ['.', ',', '?', '!', ';', ':', '>', '/']
    
    i = len(lines) - 1
    count_lines_without_special_chars = 0

    while i >= 0 and not any(lines[i].endswith(ch) for ch in special_chars):
        count_lines_without_special_chars += 1
        i -= 1

    # If at least two sentences adhere to the rules, append "Related Topics" at the bottom
    if count_lines_without_special_chars >= 2:
        lines.append("Related Topics")

    return '\n'.join(lines)

def process_solidcam_licence_text(text_file_path):
    results = []
    try:
        with open(text_file_path, 'r', encoding='utf-8') as text_file:
            lines = text_file.readlines()
            
            # Extract the first line as the link
            link = lines[0].strip()

            # Find the second line of text to use as the main header
            text_lines = [line.strip() for line in lines[1:] if line.strip()]  # Start from second line
            main_header = text_lines[0] if text_lines else None  # First non-empty line after the link

            # Join all lines for the page content, starting from the line after the main header
            page_content = " ".join(text_lines[1:]) if len(text_lines) > 1 else ""

            results.append({
                "header": f"{main_header} | {link}",
                "contents": [
                    {
                        "page_number": 0,
                        "PageContent": page_content
                    }
                ]
            })

    except FileNotFoundError:
        print(f"Text file {text_file_path} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

    return results




def process_webinar_text(text_file_path):
    results = []
    try:
        with open(text_file_path, 'r', encoding='utf-8') as text_file:
            main_header = None  # Initialize main_header as None
            for line in text_file:
                line = line.strip()
                if line:  # Check if the line contains text
                    main_header = line  # Set main_header
                    break  # Exit the loop
            remaining_lines = text_file.readlines()
            
            paragraphs = []
            current_paragraph = []
            for line in remaining_lines:
                line = line.strip()
                if line:
                    current_paragraph.append(line)
                else:
                    if current_paragraph:
                        paragraphs.append(" ".join(current_paragraph))
                        current_paragraph = []
            
            if current_paragraph:
                paragraphs.append(" ".join(current_paragraph))
            
            for paragraph in paragraphs:
                first_paren_index = paragraph.find('(')
                if first_paren_index != -1:
                    first_line = paragraph[:first_paren_index].strip()
                    rest_of_paragraph = paragraph[first_paren_index:]
                else:
                    first_line = paragraph
                    rest_of_paragraph = ''
                
                header_and_first_line = f"{main_header} | {first_line}"
                
                paragraph_data = {
                    "header": header_and_first_line,
                    "contents": [
                        {
                            "page_number": 0,
                            "PageContent": rest_of_paragraph
                        }
                    ]
                }
                results.append(paragraph_data)
            
    except FileNotFoundError:
        print(f"Text file {text_file_path} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

    return results


if __name__ == "__main__":
    pdf_path = sys.argv[1]  # Get the PDF path from the command line argument
    folder_name = os.path.basename(os.path.dirname(pdf_path))
    # Check if 'webinar' is in the file name
    if pdf_path.endswith('.txt'):
        if 'Webinar' in pdf_path:
            results = process_webinar_text(pdf_path)
            sys.stdout.write(json.dumps(results))
        elif 'SolidCAM licencing' in pdf_path:
            results = process_solidcam_licence_text(pdf_path)
            sys.stdout.write(json.dumps(results))
            pass
    else:
        pages_with_home = find_pages_starting_with(pdf_path, "Home >")
        # print(pages_with_home)
        # input()

        grouped_results = {}

        for page_info in pages_with_home:

            header = combine_multiline_header(page_info['header'])
            
            if header not in grouped_results:
                grouped_results[header] = []

            # Access 'page_number' and 'pageContent' directly from the page_info dictionary
            page_number = page_info['page_number']
            PageContent_text = page_info['pageContent']  # Make sure this key matches the exact key in your dictionary

            # Append "Related Topics" where necessary
            PageContent_text = append_related_topics(PageContent_text)
            # Clean the PageContent using the remove_related_topics_sentences function
            PageContent_text = remove_related_topics_block(PageContent_text)
            # print(PageContent_text)
            # input()
            # Store the cleaned PageContent with its page number
            content_data = {
                "page_number": page_number,
                "PageContent": PageContent_text
            }
            grouped_results[header].append(content_data)



        # Convert the dictionary to a list format
        results = [{"header": key, "contents": value} for key, value in grouped_results.items()]
        for item in results:
            item['header'] = item['header'].replace("Home", folder_name)
        # if results:
        #     results.pop()
        # print('results:', results)
        # input()
        sys.stdout.write(json.dumps(results))





